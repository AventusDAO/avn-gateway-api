terraform {
  backend "s3" {
    encrypt                = true
    bucket                 = "tf-state-avn-1"
    key                    = "env:/production/testnet/avn-gateway/vpc/terraform.tfstate"
    region                 = "eu-west-2"
    skip_region_validation = "true"
  }

  required_version = ">= 0.14"

  required_providers {
    aws = {
      version = ">= 3.6.2"
      source  = "hashicorp/aws"
    }
  }
}

provider "aws" {
  region = var.region
}
