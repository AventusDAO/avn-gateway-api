variable "username" {
  description = "Username"
  type        = string
  default     = "lambda"
}

variable "secret_recovery_window" {
  description = "Recovery window after deleting the secret"
  type        = number
  default     = 0
}

variable "secret_name" {
  description = "Name of the secret saved in AWS Secret Manager"
  type        = string
}
