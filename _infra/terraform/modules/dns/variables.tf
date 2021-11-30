variable "vpc_name" {
  description = "Name of the VPC"
  type        = string
  default     = "gateway-api"
}

variable "vpc_id" {
  description = "VPC id"
  type        = string
}

variable "environment" {
  description = "environment name"
  type        = string
}