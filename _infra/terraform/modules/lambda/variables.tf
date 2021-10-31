variable "service_version" {
  type        = string
  description = "Lambda version"
  default     = "latest"
}

variable "region" {
  type    = string
  default = "eu-west-2"
}

variable "artifact_bucket" {
  type        = string
  description = "S3 bucket that stores the lambda artifacts"
}

variable "log_retention_period" {
  type        = number
  description = "retention period for cloudwatch logs on lambda functions can be 1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653, and 0. (0 = never expire)"
  default     = 90
}

variable "lambda_runtime" {
  type        = string
  description = "Runtime for the lambda functions"
  default     = "nodejs14.x"
}

variable "lambda_functions" {
  type        = any
  description = "Map of lambda functions and their environment variables"
  default     = {
    "authorisation-handler": {},
    "poll-handler": {},
    "send-handler": {},
    "query-handler": {}
  }
}