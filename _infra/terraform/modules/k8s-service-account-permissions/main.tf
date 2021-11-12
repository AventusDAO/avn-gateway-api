resource "aws_iam_policy" "avn_connector_rabbit_secret_access" {
  name        = "avn-connector"
  path        = "/"
  description = "avn-connector permission to acceess rabbit credentials"

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
            "${var.oidc_provider}:sub": "system:serviceaccount:${each.key}:avn-connector"
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
