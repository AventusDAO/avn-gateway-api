variable "name" {
  type        = string
  description = "VPC tagged name"
  default     = "gateway-api"
}

variable "env" {
  type        = string
  description = "Environment name"
}

variable "instance_tenancy" {
  type        = string
  description = "Instance launch configuration, can be one of default, dedicated or host. See https://docs.aws.amazon.com/autoscaling/ec2/userguide/auto-scaling-dedicated-instances.html"
  default     = "default"
}

variable "enable_dns_hostnames" {
  type        = bool
  description = "enable/disable DNS hostnames in the VPC"
  default     = true
}

variable "vpc_cidr_block" {
  type        = string
  description = "VPC Cidr block, must contain enough IPs to allow to scale"
}

variable "private_zone_ips" {
  type        = map
  description = "CIDR blocks of private availability zones"
  default     = {
    "a": "172.16.0.0/22",
    "b": "172.16.4.0/22",
    "c": "172.16.8.0/22"
  }
}

variable "public_zone_ips" {
  type        = map
  description = "CIDR blocks of public availability zones"
  default     = {
    "a": "172.16.12.0/24",
    "b": "172.16.13.0/24",
    "c": "172.16.14.0/24"
  }
}

variable "private_subnet_additional_tags" {
  description = "tags for private subnet"
  type        = map
  default     = {}
}

variable "public_subnet_additional_tags" {
  description = "tags for public subnet"
  type        = map
  default     = {}
}

variable "avn_vpc_owner_id" {
  type        = string
  description = "AWS account ID of the VPC used by the avn blockchain"
  default     = "602004642405"
}

variable "avn_vpc_id" {
  type        = string
  description = "VPC ID that houses the AnN blockchain"
  default     = ""
}

variable "peer_region" {
  type        = string
  description = "Region of the avn blockchain VPC"
  default     = "eu-west-2"
}

variable "peer_public_route_table" {
  type        = string
  description = "The route table id that handles public subnet traffic in the peer VPC"
  default     = ""
}

variable "peer_private_route_table" {
  type        = string
  description = "The route table id that handles private subnet traffic in the peer VPC"
  default     = ""
}