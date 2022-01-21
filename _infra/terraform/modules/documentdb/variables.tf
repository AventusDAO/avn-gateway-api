variable "backup_retention_period" {
  description = "Retention period for backups"
  type        = number
  default     = 7
}

variable "apply_changes_immediately" {
  description = "Apply changes immediately or during the maintenance window"
  type        = bool
  default     = true
}

variable "deletion_protection" {
  description = "If enabled the cluster cannot be accidently destroyed"
  type        = bool
  default     = false
}

variable "secret_recovery_window" {
  description = "Recovery window for the secret. A value of 0 means the secret can be deleted instantly"
  type        = number
  default     = 0
}

variable "username" {
  description = "documentdb master username"
  type        = string
  default     = "AvnGateway"
}

variable "subnet_ids" {
  description = "subnet id to deploy the cluster"
  type        = list(string)
}

variable "vpc_id" {
  type = string
}

variable "cluster_instance_count" {
  description = "number of instances"
  type        = number
  default     = 1
}

variable "instance_type" {
  description = "Cluster instance type"
  type        = string
  default     = "db.t4g.medium"
}

variable "additional_whitelist_ips" {
  description = "IPs for the database to whitelist"
  type        = list(string)
  default     = []
}