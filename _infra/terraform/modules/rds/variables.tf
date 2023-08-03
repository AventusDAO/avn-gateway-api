variable "multi_az" {
  description = "Specifies if the RDS instance is multi-AZ"
  type        = bool
  default     = false
}

variable "backup_retention_period" {
  description = "The days to retain backups for"
  type        = number
  default     = 7
}

variable "allocated_storage" {
  description = "The allocated storage in gigabytes"
  type        = string
  default     = 20
}

variable "max_allocated_storage" {
  description = "Specifies the value for Storage Autoscaling"
  type        = number
  default     = 50
}

variable "subnet_ids" {
  description = "List of subnets ids to add to the subnet group"
  type        = list(string)
}

variable "vpc_id" {
  description = "VPC id where the RDS will be provisioned"
  type        = string
}

variable "performance_insights_enabled" {
  description = "Specifies whether Performance Insights are enabled"
  type        = bool
  default     = false
}

variable "performance_insights_retention_period" {
  description = "The amount of time in days to retain Performance Insights data. Valid values are `7`, `731` (2 years) or a multiple of `31`"
  type        = number
  default     = 7
}

variable "parachain_vpc_cidr_block" {
  description = "Parachain VPC cidr block"
  type        = string
}