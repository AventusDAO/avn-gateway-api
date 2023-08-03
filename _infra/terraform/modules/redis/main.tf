locals {
  user = {
    username = var.username
    password = random_password.redis.result
  }
}

resource "random_password" "redis" {
  length           = 20
  special          = true
  override_special = "@*~"
}

resource "aws_security_group" "redis" {
  name        = "redis-cluster"
  description = "Redis MemoryDB Security Group"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = "6379"
    to_port     = "6379"
    protocol    = "tcp"
    cidr_blocks = var.ip_whitelist
  }

  ingress {
    description = "Allow all traffic from parachain VPC"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.parachain_vpc_cidr_block]
  }

  egress {
    from_port   = "0"
    to_port     = "0"
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "redis-cluster"
  }
}

resource "aws_secretsmanager_secret" "redis" {
  name                    = "redis"
  recovery_window_in_days = var.secret_recovery_window
}

resource "aws_secretsmanager_secret_version" "redis" {
  secret_id     = aws_secretsmanager_secret.redis.id
  secret_string = jsonencode(local.user)
}