variable "ssh_allowed_ips" {
  type        = list(string)
  description = "Allowed ips for incoming ssh connections"
  default = [
    "18.135.167.38/32",  # IP of the nat of Testnet (Jenkins)
    "86.126.81.150/32",  # Vuko
    "109.101.202.38/32", # Vuko
    "94.60.55.242/32",   # Rui
    "82.6.150.35/32",    # Nahu
  ]
}

variable "vpc_id" {
  type        = string
  description = "The ID of the VPC"
}

variable "public_subnet_id" {
  type        = string
  description = "The main public subnet ID"
}

variable "ssh_key_name" {
  type        = string
  description = "The ssh key used to create the instance & allow ssh access"
}

