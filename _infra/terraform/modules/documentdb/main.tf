locals {
  user = {
    username = var.username
    password = random_password.docdb_password.result
  }
  subnet_ids         = var.subnet_ids
  subnet_cidr_blocks = [for k, subnet in data.aws_subnet.subnets : subnet.cidr_block]
  whitelist_ips      = concat(local.subnet_cidr_blocks, var.additional_whitelist_ips)
}

data "aws_subnet" "subnets" {
  for_each = toset(var.subnet_ids)

  id = each.key
}

resource "random_password" "docdb_password" {
  length           = 20
  special          = true
  override_special = "!@()[]{}"
}

resource "aws_docdb_cluster" "docdb" {
  cluster_identifier        = "avn-connector"
  engine                    = "docdb"
  engine_version            = "4.0.0"
  master_username           = local.user.username
  master_password           = local.user.password
  backup_retention_period   = var.backup_retention_period
  preferred_backup_window   = "02:00-04:00"
  skip_final_snapshot       = false
  final_snapshot_identifier = "avn-connector-docdb-final-snap"
  apply_immediately         = var.apply_changes_immediately
  deletion_protection       = var.deletion_protection
  db_subnet_group_name      = aws_docdb_subnet_group.docdb.id
  vpc_security_group_ids    = [aws_security_group.documentdb.id]

  tags = {
    Name = "avn-connector"
  }
}

resource "aws_docdb_subnet_group" "docdb" {
  name       = "avn-gateway"
  subnet_ids = var.subnet_ids

  tags = {
    Name = "The avn-gateway subnet for documentdb"
  }
}

resource "aws_docdb_cluster_instance" "cluster_instances" {
  count              = var.cluster_instance_count
  identifier         = "avn-connector-${count.index}"
  cluster_identifier = aws_docdb_cluster.docdb.id
  instance_class     = var.instance_type
}

resource "aws_security_group" "documentdb" {
  name        = "documentdb"
  description = "Allow subnet access to the MongoDB port"
  vpc_id      = var.vpc_id

  ingress {
    description = "MongoDB port from vpc subnets"
    from_port   = "27017"
    to_port     = "27017"
    protocol    = "tcp"
    cidr_blocks = local.whitelist_ips
  }

  egress {
    from_port   = "0"
    to_port     = "0"
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "documentdb-subnet-access"
  }
}

resource "aws_secretsmanager_secret" "documentdb" {
  name                    = "documentdb"
  recovery_window_in_days = var.secret_recovery_window
}

resource "aws_secretsmanager_secret_version" "documentdb" {
  secret_id = aws_secretsmanager_secret.documentdb.id
  secret_string = jsonencode(
    merge(local.user, { server = aws_docdb_cluster.docdb.endpoint })
  )
}