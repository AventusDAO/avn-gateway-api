resource "aws_elasticache_cluster" "redis" {
  count                = var.replication_enabled ? 0 : 1
  cluster_id           = "gateway-api-cache"
  engine               = "redis"
  node_type            = var.node_type
  num_cache_nodes      = 1
  parameter_group_name = "default.redis${var.redis_version}"
  engine_version       = var.redis_version
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.redis.name
  security_group_ids   = aws_security_group.redis.id
}

resource "aws_elasticache_replication_group" "example" {
  count                         = var.replication_enabled ? 1 : 0
  automatic_failover_enabled    = true
  availability_zones            = ["${var.region}a", "${var.region}b", "${var.region}c"]
  replication_group_id          = "gateway-api-replication-group"
  replication_group_description = "Replication group for the gateway api cache"
  node_type                     = var.node_type
  number_cache_clusters         = var.replica_node_count
  parameter_group_name          = "default.redis${var.redis_version}"
  port                          = 6379
}

resource "aws_elasticache_subnet_group" "bar" {
  name       = "tf-test-cache-subnet"
  subnet_ids = var.subnet_ids
}

resource "aws_security_group" "redis" {
  name = "redis"
  description = "ElastiCache Redis Security Group"
  vpc_id = var.vpc_id

  ingress {
    from_port = "6739"
    to_port = "6739"
    protocol = "tcp"
    cidr_blocks = var.ip_whitelist
  }

  egress {
    from_port = "0"
    to_port = "0"
    protocol = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "ElastiCache Redis Node"
  }
}