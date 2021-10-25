variable "kms_key_arn" {
  description = "kms key used for encrypting kubernetes secrets."
  type        = string
  default     = ""
}

variable "vpc_id" {
  description = "VPC id that the eks cluster will live"
  type        = string
}

variable "log_retention_in_days" {
  description = "log retention period"
  type        = number
  default     = 1
}

variable "cluster_name" {
  type = string
}

variable "kubernetes_version" {
  type    = string
  default = "1.21"
}

variable "endpoint_public_access" {
  type    = bool
  default = true
}

variable "endpoint_private_access" {
  type    = bool
  default = true
}

variable "public_access_cidrs" {
  description = "List of CIDRs granted access to the API server"
  type        = list(string)
}

variable "worker_cidrs" {
  description = "List of CIDRs granted access to the API server"
  type        = list(string)
}

variable "node_group_name" {
  type    = string
  default = "gateway-api"
}

variable "subnet_ids" {
  description = "Deploy nodegroup into these subnets"
  type        = list(string)
}

variable "template_instance_type" {
  description = "Instance type for the node group launch template"
  type        = string
  default     = "t3.medium"
}

variable "taints" {
  description = "Map of node taints, expect taint to be of the form { 'availability': 'avn' }"
  type        = map
  default     = {}
}

variable "labels" {
  description = "Map of node labels."
  type        = map
  default     = {
    "availability": "free"
  }
}

variable "desired_size" {
  description = "Desired size of the node pool"
  type        = number
  default     = 2
}

variable "max_size" {
  description = "Desired size of the node pool"
  type        = number
  default     = 10
}

variable "min_size" {
  description = "Desired size of the node pool"
  type        = number
  default     = 2
}

variable "environment" {
  description = "Environment name (dev, sandbox.. etc)"
  type        = string
  default     = "sandbox"
}

variable "capacity_type" {
  description = "Type of instance, ON_DEMAND or SPOT"
  type        = string
  default     = "ON_DEMAND"
}

variable "max_unavailable_for_update" {
  description = "Max number of nodes unavailable for update"
  type        = number
  default     = 1
}