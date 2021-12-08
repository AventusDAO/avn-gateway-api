data "aws_subnet" "subnets" {
  for_each = toset(var.subnet_ids)

  vpc_id = var.vpc_id
  id     = each.key
}

locals {
  user = {
    username = var.username
    password = random_password.mq_password.result
  }
  subnet_ids = var.deployment_mode == "SINGLE_INSTANCE" ? [
      for k, subnet in data.aws_subnet.subnets: subnet.id if subnet.map_public_ip_on_launch && 
        length(regexall("az1$", subnet.availability_zone_id)) > 0
    ] : [
      for k, subnet in data.aws_subnet.subnets: subnet.id if !subnet.map_public_ip_on_launch
    ]

  subnet_cidr_blocks = [for k, subnet in data.aws_subnet.subnets: subnet.cidr_block]
  security_groups    = var.publicly_accessible ? null : [aws_security_group.rabbit["private"].id]
}

resource "random_password" "mq_password" {
  length           = 20
  special          = true
  override_special = "!@()[]{}"
}

resource "aws_mq_broker" "gateway" {
  broker_name = var.mq_name

  engine_type         = "RabbitMQ"
  engine_version      = var.engine_version
  storage_type        = "ebs"
  host_instance_type  = var.instance_type
  apply_immediately   = var.immediate_updates
  security_groups     = local.security_groups
  subnet_ids          = local.subnet_ids
  deployment_mode     = var.deployment_mode
  publicly_accessible = var.publicly_accessible

  authentication_strategy = "simple"

  user {
    username = local.user.username
    password = local.user.password
  }

  maintenance_window_start_time {
    day_of_week = "TUESDAY"
    time_of_day = "02:00"
    time_zone   = "UTC"
  }
}

resource "aws_security_group" "rabbit" {
  for_each = var.publicly_accessible ? [] : toset(["private"])

  name        = "rabbitmq"
  description = "Allow subnet access to the rabbit port"
  vpc_id      = var.vpc_id

  ingress {
    description      = "rabbit port from vpc subnets"
    from_port        = "5671"
    to_port          = "5672"
    protocol         = "tcp"
    cidr_blocks      = local.subnet_cidr_blocks
  }

  egress {
    from_port        = "0"
    to_port          = "0"
    protocol         = "-1"
    cidr_blocks      = ["0.0.0.0/0"]
  }

  tags = {
    Name = "rabbitmq-subnet-access"
  }
}

resource "aws_secretsmanager_secret" "rabbit" {
  name                    = "rabbitmq"
  recovery_window_in_days = var.secret_recovery_window
}

resource "aws_secretsmanager_secret_policy" "rabbit" {
  secret_arn = aws_secretsmanager_secret.rabbit.arn

  policy = <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EnableAllPermissions",
      "Effect": "Allow",
      "Principal": {
        "AWS": "*"
      },
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "*"
    }
  ]
}
POLICY
}

resource "aws_secretsmanager_secret_version" "rabbit" {
  secret_id     = aws_secretsmanager_secret.rabbit.id
  secret_string = jsonencode(
    merge(local.user, { server = aws_mq_broker.gateway.instances.0.endpoints.0 })
  )
}