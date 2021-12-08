variable "authoriser_invoke_arn" {
  type        = string
  description = "The invoke ARN of the authorisation handler Lambda function"
}

variable "poll_invoke_arn" {
  type        = string
  description = "The invole ARN of the poll handler Lambda function"
}

variable "query_invoke_arn" {
  type        = string
  description = "The invoke ARN of the query handler Lambda function"
}

variable "send_invoke_arn" {
  type        = string
  description = "The invoke ARN of the send handler Lambda function"
}

variable "authoriser_arn" {
  type        = string
  description = "The lambda arn of the authoriser"
}

variable "log_retention_period" {
  type        = number
  description = "Log retention"
  default     = 1
}

variable "auth_cache_duration" {
  type        = number
  description = "Authorizer cache duration in seconds"
  default     = 300
}
