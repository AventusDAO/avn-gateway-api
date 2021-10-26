variable "region" {
  default = "eu-west-1"
}

variable "service_version" {
  type        = string
  description = "Version of the lambda functions, will usually be a github short sha or pr number"
}