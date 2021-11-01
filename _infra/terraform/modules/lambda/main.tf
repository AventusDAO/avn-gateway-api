locals {
  lambdas = { for k, v in var.lambda_functions : k => {
      env_vars = flatten([lookup(v, "env_vars", [])])
    } 
  }
}

resource "aws_lambda_function" "lambda" {
  for_each      = local.lambdas
  s3_bucket     = var.artifact_bucket
  s3_key        = "${each.key}/${each.key}-${var.service_version}.zip"
  function_name = each.key
  role          = aws_iam_role.logging_role.arn
  handler       = "index.handler"
  description   = "${each.key} - Deployed by Terraform" 
  runtime       = var.lambda_runtime

  dynamic "environment" {
    for_each = each.value["env_vars"]
    content {
      variables = environment.value
    }
  }
}

resource "aws_cloudwatch_log_group" "lambda" {
  for_each          = local.lambdas
  name              = "/aws/lambda/${each.key}"
  retention_in_days = var.log_retention_period

  depends_on = [
    aws_lambda_function.lambda
  ]
}

resource "aws_iam_role" "logging_role" {
  name = "LambdaLogging"

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
  name        = "lambda_logging"
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
      "Resource": "arn:aws:logs:${var.region}:*:*",
      "Effect": "Allow"
    }
  ]
}
EOF
}

resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.logging_role.name
  policy_arn = aws_iam_policy.lambda_logging.arn
}

resource "aws_lambda_permission" "allow_api" {
  for_each      = local.lambdas
  statement_id  = "AllowAPIgatewayInvocation"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.lambda[each.key].function_name
  principal     = "apigateway.amazonaws.com"
}
