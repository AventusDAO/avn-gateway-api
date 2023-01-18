#
# Lambda Cloudwatch
#
data "aws_iam_policy_document" "lambda_logging" {
  statement {
    effect = "Allow"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]
    resources = [
      "arn:aws:logs:${data.aws_region.current.name}:*:*",
    ]
  }
}

resource "aws_iam_policy" "lambda_logging" {
  name        = "lambda_gateway_logging"
  path        = "/"
  description = "IAM policy for logging from a lambda"
  policy      = data.aws_iam_policy_document.lambda_logging.json
}

#
# RabbitMQ access
#
data "aws_iam_policy_document" "rabbit_secret_access" {
  statement {
    effect = "Allow"
    actions = [
      "secretsmanager:GetSecretValue"
    ]
    resources = [
      "${var.rabbit_secret_arn}",
    ]
  }
}

resource "aws_iam_policy" "rabbit_secret_access" {
  name        = "send-handler-rabbit-secret"
  path        = "/"
  description = "IAM policy for accessing the rabbitmq user/password"
  policy      = data.aws_iam_policy_document.rabbit_secret_access.json
}

#
# lambda Network Access
#
data "aws_iam_policy_document" "lambda_network" {
  statement {
    effect = "Allow"
    actions = [
      "ec2:DescribeInstances",
      "ec2:CreateNetworkInterface",
      "ec2:AttachNetworkInterface",
      "ec2:DescribeNetworkInterfaces",
      "ec2:DeleteNetworkInterface",
      "autoscaling:CompleteLifecycleAction"
    ]
    resources = [
      "*",
    ]
  }
}

resource "aws_iam_policy" "lambda_network" {
  name        = "lambda-network-interfaces"
  path        = "/"
  description = "IAM policy for creating/deleting network interfaces for lambdas"
  policy      = data.aws_iam_policy_document.lambda_network.json
}

#
# Access to vote S3 bucket
#
data "aws_iam_policy_document" "full_access_vote_buckets" {
  statement {
    effect = "Allow"
    actions = [
      "s3:ListBucket",
    ]
    resources = [
      "arn:aws:s3:::${local.vote_handler_avn_bucket}",
    ]
  }

  statement {
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject"
    ]
    resources = [
      "arn:aws:s3:::${local.vote_handler_avn_bucket}/*",
    ]
  }
}

resource "aws_iam_policy" "full_access_vote_buckets" {
  name        = "vote_bucket_access"
  description = "full access to vote bucket with name ${local.vote_handler_avn_bucket}"

  policy = data.aws_iam_policy_document.full_access_vote_buckets.json
}

#
# SQS access
#
data "aws_iam_policy_document" "sender_sqs_access" {
  statement {
    effect = "Allow"
    actions = [
      "sqs:SendMessage",
      "sqs:SendMessageBatch"
    ]
    resources = [
      "${var.sqs_queue_arns.gateway_default_queue}",
      "${var.sqs_queue_arns.gateway_payer_queue}"
    ]
  }
}

resource "aws_iam_policy" "sender_sqs_access" {
  name        = "avn-gateway-send-hendler-sqs"
  description = "allow send hendler to send messages to SQS"
  policy      = data.aws_iam_policy_document.sender_sqs_access.json
}
