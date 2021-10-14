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
