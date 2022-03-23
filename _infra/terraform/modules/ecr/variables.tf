variable "project_name" {
  type        = string
  description = "The project name that creates an ECR"
}

variable "ecr_repositories" {
  type        = list(string)
  description = "List of the repositories to be created for the project"
}

variable "account_ids" {
  type        = list(string)
  description = "list of account ids with the avn-gateway role for adding to the ecr permission set."
}

variable "image_count" {
  type        = number
  description = "Number of images to keep"
  default     = 100
}
