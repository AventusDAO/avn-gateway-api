module "this" {
  source  = "terraform-aws-modules/rds/aws"
  version = "5.2.3"

  identifier = "gateway-db"

  # All available versions: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html#PostgreSQL.Concepts
  engine                     = "postgres"
  engine_version             = "14.5"
  family                     = "postgres14"
  major_engine_version       = "14"
  instance_class             = "db.t4g.small"
  auto_minor_version_upgrade = false

  storage_type          = "gp3"
  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage

  username = "root"
  port     = 5432

  multi_az               = var.multi_az
  db_subnet_group_name   = aws_db_subnet_group.this.id
  vpc_security_group_ids = [aws_security_group.this.id]

  maintenance_window              = "Mon:00:00-Mon:03:00"
  backup_window                   = "03:00-06:00"
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  create_cloudwatch_log_group     = true

  backup_retention_period = var.backup_retention_period
  skip_final_snapshot     = false
  deletion_protection     = true

  performance_insights_enabled          = var.performance_insights_enabled
  performance_insights_retention_period = var.performance_insights_retention_period
  create_monitoring_role                = true
  monitoring_interval                   = 60
  monitoring_role_name                  = "rds-gateway-db-monitoring"

  parameters = [
    {
      name  = "autovacuum"
      value = 1
    },
    {
      name  = "client_encoding"
      value = "utf8"
    }
  ]

  tags = local.all_resources_tags
}

resource "aws_db_subnet_group" "this" {
  name        = "gateway-db-group"
  description = "Database subnet group for rds gateway"
  subnet_ids  = var.subnet_ids

  tags = local.all_resources_tags
}

resource "aws_security_group" "this" {
  name        = "rds gateway"
  description = "Allow local traffic only"
  vpc_id      = var.vpc_id

  ingress {
    description = "Allow all traffic from within the VPC"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [data.aws_vpc.current.cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [data.aws_vpc.current.cidr_block]
  }

  tags = local.all_resources_tags
}