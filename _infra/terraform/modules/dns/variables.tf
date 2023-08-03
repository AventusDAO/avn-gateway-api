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

variable "api_gateway_url" {
  type = string
}

variable "api_gateway_id" {
  type = string
}

variable "api_gateway_stage" {
  type = string
}

variable "parachain_vpc_id" {
  description = "Parachain VPC ID"
  type        = string
}