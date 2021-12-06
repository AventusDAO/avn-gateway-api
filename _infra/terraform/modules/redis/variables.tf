variable "ip_whitelist" {
  type        = list(string)
  description = "List of IPs for whitelisting in the redis cluster"
}

variable "vpc_id" {
  type        = string
  description = "VPC ID to create the redis secuity group"
}
