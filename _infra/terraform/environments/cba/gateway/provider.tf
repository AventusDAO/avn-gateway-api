terraform {
  backend "s3" {
    encrypt                = true
    bucket                 = "tf-state-avn-1"
    key                    = "env:/cba/gateway-api/state3.tfstate"
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

data "terraform_remote_state" "vpc" {
  backend = "s3"
  config = {
    bucket = "tf-state-avn-1"
    key    = "env:/cba/gateway-api/vpc/terraform.tfstate"
    region = "eu-west-2"
  }
}

provider "aws" {
  region = var.region

  assume_role {
    role_arn = "arn:aws:iam::602004642405:role/jenkins-access"
  }
}

provider "aws" {
  region = "us-east-1"
  alias  = "us_east_1"

  assume_role {
    role_arn = "arn:aws:iam::602004642405:role/jenkins-access"
  }
}

provider "aws" {
  alias  = "aventus"
  region = var.region

  assume_role {
    role_arn = "arn:aws:iam::707061609910:role/jenkins-access"
  }
}
