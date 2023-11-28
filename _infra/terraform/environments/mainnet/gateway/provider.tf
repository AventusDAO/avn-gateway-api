terraform {
  backend "s3" {
    encrypt                = true
    bucket                 = "tf-state-avn-1"
    key                    = "env:/production/mainnet/avn-gateway/terraform.tfstate"
    region                 = "eu-west-2"
    skip_region_validation = "true"
    role_arn               = "arn:aws:iam::503742778456:role/jenkins-access"
  }

  required_version = ">= 0.14"

  required_providers {
    aws = {
      version = ">= 3.6.2"
      source  = "hashicorp/aws"
    }
  }
}

data "terraform_remote_state" "vpc" {
  backend = "s3"
  config = {
    bucket = "tf-state-avn-1"
    key    = "env:/production/mainnet/avn-gateway/vpc/terraform.tfstate"
    region = "eu-west-2"
    role_arn               = "arn:aws:iam::503742778456:role/jenkins-access"
  }
}

provider "aws" {
  region = var.region

  assume_role {
    role_arn = "arn:aws:iam::503742778456:role/jenkins-access"
  }
}

provider "aws" {
  alias  = "aventus"
  region = var.region

  assume_role {
    role_arn = "arn:aws:iam::707061609910:role/jenkins-access"
  }
}

provider "aws" {
  region = "us-east-1"
  alias  = "us_east_1"

  assume_role {
    role_arn = "arn:aws:iam::503742778456:role/jenkins-access"
  }
}