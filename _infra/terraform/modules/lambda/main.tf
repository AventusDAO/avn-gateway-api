locals {
  lambdas = { for k, v in var.lambda_functions : k => {
      env_vars    = [lookup(v, "env_vars", {})]
      timeout     = lookup(v, "timeout", 3)
      memory_size = lookup(v, "memory_size", 128)
    } 
  }
}

data "aws_region" "current" {}

resource "aws_lambda_function" "lambda" {
  for_each      = local.lambdas
  s3_bucket     = var.artifact_bucket
  s3_key        = "${each.key}/${each.key}-${var.service_version}.zip"
  function_name = each.key
  role          = aws_iam_role.lambda_role[each.key].arn
  handler       = "${each.key}.handler"
  description   = "${each.key} - ${var.service_version} - Deployed by Terraform" 
  runtime       = var.lambda_runtime
  layers        = [aws_lambda_layer_version.common_layer.arn, aws_lambda_layer_version.queue.arn]
  timeout       = local.lambdas[each.key]["timeout"]
  memory_size   = local.lambdas[each.key]["memory_size"]

  dynamic "environment" {
    for_each = each.value["env_vars"]
    content {
      variables = merge(environment.value, {AVN_CONNECTOR_ENDPOINT = var.avn_connector_endpoint})
    }
  }

  dynamic "vpc_config" {
    for_each = length(var.subnet_ids) > 0 ? ["subnets"] : []

    content {
      security_group_ids = [aws_security_group.lambdas.id]
      subnet_ids         = var.subnet_ids
    }
  }
}

resource "aws_lambda_layer_version" "common_layer" {
  layer_name = "common"
  s3_bucket  = var.artifact_bucket
  s3_key     = "common/common-${var.service_version}.zip"

  compatible_runtimes = [var.lambda_runtime]
}

resource "aws_lambda_layer_version" "queue" {
  layer_name = "queue"
  s3_bucket  = var.artifact_bucket
  s3_key     = "queue/queue-${var.service_version}.zip"

  compatible_runtimes = [var.lambda_runtime]
}

resource "aws_cloudwatch_log_group" "lambda" {
  for_each          = local.lambdas
  name              = "/aws/lambda/${each.key}"
  retention_in_days = var.log_retention_period

  depends_on = [
    aws_lambda_function.lambda
  ]
}

resource "aws_iam_role" "lambda_role" {
  for_each = local.lambdas
  name = "${each.key}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Sid    = ""
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      },
    ]
  })
}

resource "aws_iam_policy" "lambda_logging" {
  name        = "lambda_gateway_logging"
  path        = "/"
  description = "IAM policy for logging from a lambda"

  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:${data.aws_region.current.name}:*:*",
      "Effect": "Allow"
    }
  ]
}
EOF
}

resource "aws_iam_role_policy_attachment" "lambda_logs" {
  for_each   = {for idx, val in aws_iam_role.lambda_role: idx => val}
  role       = each.value.name
  policy_arn = aws_iam_policy.lambda_logging.arn
}

resource "aws_iam_policy" "rabbit_secret_access" {
  name        = "send-handler-rabbit-secret"
  path        = "/"
  description = "IAM policy for accessing the rabbitmq user/password"

  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "${var.rabbit_secret_arn}",
      "Effect": "Allow"
    }
  ]
}
EOF
}

resource "aws_iam_policy" "lambda_network" {
  name        = "lambda-network-interfaces"
  path        = "/"
  description = "IAM policy for creating/deleting network interfaces for lambdas"

  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Resource": "*",
      "Action": [
          "ec2:DescribeInstances",
          "ec2:CreateNetworkInterface",
          "ec2:AttachNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface",
          "autoscaling:CompleteLifecycleAction"
      ]
    }
  ]
}
EOF
}


resource "aws_iam_role_policy_attachment" "rabbit_secret_access" {
  role       = aws_iam_role.lambda_role["send-handler"].name
  policy_arn = aws_iam_policy.lambda_logging.arn
}

resource "aws_iam_role_policy_attachment" "network" {
  for_each   = {for idx, val in aws_iam_role.lambda_role: idx => val}

  role       = each.value.name
  policy_arn = aws_iam_policy.lambda_network.arn
}

resource "aws_lambda_permission" "allow_api" {
  for_each      = local.lambdas
  statement_id  = "AllowAPIgatewayInvocation"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.lambda[each.key].function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_security_group" "lambdas" {
  name = "lambda-functions"
  description = "Lambda egress Security Group"
  vpc_id = var.vpc_id

  egress {
    from_port = "0"
    to_port = "0"
    protocol = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "Lambda egress Security Group"
  }
}
