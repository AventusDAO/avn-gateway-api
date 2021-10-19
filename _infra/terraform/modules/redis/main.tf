resource "aws_elasticache_cluster" "redis" {
  count                = var.replication_enabled ? 0 : 1
  cluster_id           = "gateway-api-cache"
  engine               = "redis"
  node_type            = var.node_type
  num_cache_nodes      = 1
  parameter_group_name = "default.redis${var.redis_version}"
  engine_version       = var.redis_version
  port                 = 6379
}

resource "aws_elasticache_replication_group" "example" {
  count                         = var.replication_enabled ? 1 : 0
  automatic_failover_enabled    = true
  availability_zones            = ["${var.region}a", "${var.region}b", "${var.region}c"]
  replication_group_id          = "gateway_api_replication_group"
  replication_group_description = "Replication group for the gateway api cache"
  node_type                     = var.node_type
  number_cache_clusters         = var.replica_node_count
  parameter_group_name          = "default.redis${var.redis_version}"
  port                          = 6379
}