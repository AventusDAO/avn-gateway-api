resource "aws_iam_policy" "fluent_bit" {
  name        = "fluent-bit"
  path        = "/"
  description = "Kuberentes fluentbit access to cloudwatch"

  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": [
        "logs:CreateLogStream",
        "logs:CreateLogGroup",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams"
      ],
      "Resource": "arn:aws:logs:*:*:*",
      "Effect": "Allow"
    }
  ]
}
EOF
}

resource "aws_iam_role" "fluent_bit" {
  name = "fluent-bit"

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
            "${local.oidc_url}:sub": "system:serviceaccount:kube-system:${local.fluent_bit}",
            "${local.oidc_url}:aud": "sts.amazonaws.com"
          }
        }
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "fluent_bit" {
  role       = aws_iam_role.fluent_bit.name
  policy_arn = aws_iam_policy.fluent_bit.arn
}

resource "kubernetes_service_account" "fluent_bit" {
  metadata {
    name      = local.fluent_bit
    namespace = "kube-system"
    annotations = {
      "eks.amazonaws.com/role-arn" = aws_iam_role.fluent_bit.arn
    }
  }
}