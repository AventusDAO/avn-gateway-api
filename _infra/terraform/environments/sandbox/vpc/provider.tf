terraform {
  backend "s3" {
    encrypt                = true
    bucket                 = "terraform-state-avn-gateway-api-sandbox"
    key                    = "env:/sandbox/gateway-api/vpc/terraform.tfstate"
    region                 = "eu-west-1"
    skip_region_validation = "true"
    role_arn               = "arn:aws:iam::352429414196:role/jenkins-access"
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

  assume_role {
    role_arn = "arn:aws:iam::352429414196:role/jenkins-access"
  }
}
