variable "region" {
  type = string
}

variable "redis_version" {
  type    = string
  default = "6.x"
}

variable "node_type" {
  type        = string
  description = "type of cache node that runs redis"
  default     = "cache.t2.medium"
}

variable "replica_node_count" {
  type        = number
  description = "Number of replica nodes, only applicable if replication is enabled"
  default     = 2
}

variable "replication_enabled" {
  type        = bool
  description = "Enable cache replicas"
  default     = false
}

variable "ip_whitelist" {
  type        = list(string)
  description = "List of IPs for whitelisting in the redis cluster"
}

variable "vpc_id" {
  type        = string
  description = "VPC ID to create the redis secuity group"
}

variable "subnet_ids" {
  type        = list(string)
  description = "Subnet ids to deploy the redis cluster into"
}