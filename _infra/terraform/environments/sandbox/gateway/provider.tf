terraform {
  backend "s3" {
    encrypt                = true
    bucket                 = "terraform-state-avn-gateway-api-sandbox"
    key                    = "env:/sandbox/gateway-api/terraform.tfstate"
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

data "terraform_remote_state" "vpc" {
  backend = "s3"
  config = {
    bucket   = "terraform-state-avn-gateway-api-sandbox"
    key      = "env:/sandbox/gateway-api/vpc/terraform.tfstate"
    region   = var.region
    role_arn = "arn:aws:iam::352429414196:role/jenkins-access"
  }
}

provider "aws" {
  region = var.region

  assume_role {
    role_arn = "arn:aws:iam::352429414196:role/jenkins-access"
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
    role_arn = "arn:aws:iam::352429414196:role/jenkins-access"
  }
}
