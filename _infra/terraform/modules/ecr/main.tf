locals {
  avn_ecr_project_name = var.project_name
  role_arns = formatlist("arn:aws:iam::%s:role/avn-gateway", var.account_ids)
  tags = {
    Project      = var.project_name
    Orchestrator = "Terraform"
  }

  ecr_lifecycle_policy = {
    rules : [
      {
        description : "Expire untagged images older than 1 day",
        rulePriority : 1,
        selection : {
          tagStatus : "untagged",
          countType : "sinceImagePushed",
          countUnit : "days",
          countNumber : 1
        },
        action : {
          type : "expire"
        }
      },
      {
        description : "Keep last ${var.image_count} images, no matter tagged or not",
        rulePriority : 2,
        selection : {
          tagStatus : "any",
          countType : "imageCountMoreThan",
          countNumber : var.image_count
        },
        action : {
          type : "expire"
        }
      }
    ]
  }
}

resource "aws_ecr_repository" "avn_ecr_repo" {
  for_each = toset(var.ecr_repositories)

  name = "${local.avn_ecr_project_name}/${each.value}"
  tags = local.tags

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_ecr_lifecycle_policy" "avn_ecr_repo" {
  for_each = toset(var.ecr_repositories)

  repository = aws_ecr_repository.avn_ecr_repo[each.key].name
  policy     = jsonencode(local.ecr_lifecycle_policy)
}

data "aws_iam_policy_document" "ecr_policy_document" {
  version = "2008-10-17"
  statement {
    effect  = "Allow"
    sid     = "AllowPull"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
    ]

    principals {
      type = "AWS"
      identifiers = [local.role_arns]
    }
  }
}

resource "aws_ecr_repository_policy" "avn_ecr_repo_policy" {
  for_each = toset(var.ecr_repositories)

  repository = aws_ecr_repository.avn_ecr_repo[each.key].name

  policy = data.aws_iam_policy_document.ecr_policy_document.json
}
