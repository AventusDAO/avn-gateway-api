variable "region" {
  default = "eu-west-2"
}

variable "account_ids" {
  description = "Role arns for kubernetes nodes across different accounts"
  type        = list(string)
  default     = [
    "791662239430",
    "352429414196",
    "503742778456",
    "189013141504",
    "602004642405"
  ]
}
