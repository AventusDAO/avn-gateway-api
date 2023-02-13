variable "domain" {
  description = "Cognito User Pool domain"
  type        = string
  default     = null
}

variable "user_pool_advanced_security_mode" {
  description = "The mode for advanced security, must be one of `OFF`, `AUDIT` or `ENFORCED`"
  type        = string
  default     = "OFF"
}

variable "domain_certificate_arn" {
  description = "The ARN of an ISSUED ACM certificate in `us-east-1` for a custom domain"
  type        = string
  default     = null
}

variable "hosted_zone" {
  description = "Hosted Zone name of the desired Hosted Zone."
  type        = string
  default     = null
}

variable "callback_urls" {
  description = "Cognito callback url - URL redirected after successful login."
  type        = list(string)
}

variable "logout_urls" {
  description = "Cognito logout urls - URL redirected after successful logout."
  type        = list(string)
}
