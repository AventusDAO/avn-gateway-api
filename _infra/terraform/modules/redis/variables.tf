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
  description = "Number of replica nodes"
  default     = 2
}

variable "replication_enabled" {
  type        = bool
  description = "Enable cache replicas"
  default     = false
}