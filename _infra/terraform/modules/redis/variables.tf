variable "ip_whitelist" {
  type        = list(string)
  description = "List of IPs for whitelisting in the redis cluster"
}

variable "vpc_id" {
  type        = string
  description = "VPC ID to create the redis secuity group"
}

variable "username" {
  type        = string
  description = "Redis username"
  default     = "avn-connector"
}

variable "secret_recovery_window" {
  type    = number
  default = 0
}

variable "parachain_vpc_cidr_block" {
  description = "Parachain VPC cidr block"
  type        = string
}