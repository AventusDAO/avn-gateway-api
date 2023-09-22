variable "mq_name" {
  description = "name of the message broker"
  type        = string
  default     = "avn_gateway"
}

variable "engine_version" {
  description = "MQ version, defaults to latest RabbitMQ version of 3.8.22"
  type        = string
  default     = "3.8.22"
}

variable "instance_type" {
  description = "Type of instance that runs the broker, mq.m5.large is the smallest instance size after mq.t3.micro that is supported for rabbitmq"
  type        = string
  default     = "mq.m5.large"
}

variable "username" {
  description = "MQ username"
  type        = string
  default     = "lambda"
}

variable "immediate_updates" {
  description = "Apply updates to this resource immediately or during the next maintenance window"
  type        = bool
  default     = false
}

variable "publicly_accessible" {
  description = "enable connections from applications outside of the VPC that hosts the broker's subnets"
  type        = bool
  default     = false
}

variable "deployment_mode" {
  description = "Deployment mode of the broker. Valid values are SINGLE_INSTANCE, ACTIVE_STANDBY_MULTI_AZ, and CLUSTER_MULTI_AZ."
  type        = string
  default     = "SINGLE_INSTANCE"
}

variable "subnet_ids" {
  description = "List of subnet IDs in which to launch the broker. A SINGLE_INSTANCE deployment requires one subnet. An ACTIVE_STANDBY_MULTI_AZ deployment requires multiple subnets."
  type        = list(string)
}

variable "vpc_id" {
  description = "ID of the VPC the rabbit cluster will be deployed"
  type        = string
}

variable "secret_recovery_window" {
  description = "Recovery window after deleting the secret"
  type        = number
  default     = 0
}

variable "parachain_vpc_cidr_block" {
  description = "Parachain VPC cidr block"
  type        = string
}