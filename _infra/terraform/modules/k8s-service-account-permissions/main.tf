locals {
  oidc_arn_prefix  = split("/", var.oidc_provider)[0]
  oidc_url         = trimprefix(var.oidc_provider, "${local.oidc_arn_prefix}/")
  lb_controller    = "aws-load-balancer-controller"
  external_secrets = "kubernetes-external-secrets" 
  external_dns     = "external-dns"
}

data "aws_lambda_function" "tx_handler" {
  function_name = "tx-status-update-handler"
}

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

resource "aws_iam_policy" "avn_connector_rabbit_secret_access" {
  name        = "avn-connector"
  path        = "/"
  description = "avn-connector permissions for rabbit secret access and lambda invoke"

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
    },
    {
      "Action": [
        "lambda:InvokeFunction"
      ],
      "Resource": "${data.aws_lambda_function.tx_handler.arn}",
      "Effect": "Allow"
    }
  ]
}
EOF
}

resource "aws_iam_role" "avn_connector" {
  for_each = toset(var.namespaces)

  name = "k8s-sa-${each.key}-avn-connector"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRoleWithWebIdentity",
        Effect = "Allow"
        Sid    = ""
        Principal = {
          Federated = var.oidc_provider
        }
        Condition = {
          StringEquals = {
            "${local.oidc_url}:sub": "system:serviceaccount:${each.key}:avn-connector",
            "${local.oidc_url}:aud": "sts.amazonaws.com"
          }
        }
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "avn_connector" {
  for_each   = toset(var.namespaces)
  role       = aws_iam_role.avn_connector[each.key].name
  policy_arn = aws_iam_policy.avn_connector_rabbit_secret_access.arn
}