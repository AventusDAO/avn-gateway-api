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
# Send hendler SQS access
#
data "aws_iam_policy_document" "send_handler_access" {
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

resource "aws_iam_policy" "send_handler_access" {
  name        = "avn-gateway-send-handler-access"
  description = "allow send hendler to send messages to SQS and read SM"
  policy      = data.aws_iam_policy_document.send_handler_access.json
}

#
# split-fee-handler SQS access
#
data "aws_iam_policy_document" "split_fee_access" {
  statement {
    effect = "Allow"
    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:DeleteMessageBatch",
      "sqs:GetQueueAttributes",
    ]
    resources = [
      "${var.sqs_queue_arns.gateway_payer_queue}",
    ]
  }

  statement {
    effect = "Allow"
    actions = [
      "sqs:SendMessage",
      "sqs:SendMessageBatch"
    ]
    resources = [
      "${var.sqs_queue_arns.gateway_default_queue}",
    ]
  }
}

resource "aws_iam_policy" "split_fee_access" {
  name        = "avn-gateway-split-fee-hendler-access"
  description = "spit fee access to SQS and SM"
  policy      = data.aws_iam_policy_document.split_fee_access.json
}

#
# tx-dispatch-handler SQS access
#
data "aws_iam_policy_document" "tx_dispatch_access" {
  statement {
    effect = "Allow"
    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:DeleteMessageBatch",
      "sqs:GetQueueAttributes",
    ]
    resources = [
      "${var.sqs_queue_arns.gateway_default_queue}",
    ]
  }

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

resource "aws_iam_policy" "tx_dispatch_access" {
  name        = "avn-gateway-tx-dispatch-hendler-access"
  description = "allow access to SQS and SM"
  policy      = data.aws_iam_policy_document.tx_dispatch_access.json
}
