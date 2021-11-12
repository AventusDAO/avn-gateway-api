variable "oidc_provider" {
  description = "OIDC provider arn"
  type        = string
}

variable "rabbit_secret_arn" {
  description = "ARN of the rabbit credentials"
  type        = string
}

variable "namespaces" {
  description = "Supply a list of objects of namespaces to service account names, namespace: service_account"
  type        = list(string)
  default     = [
    "avn-connector"
  ]
}