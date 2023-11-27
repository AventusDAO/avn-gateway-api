data "aws_iam_user" "eks" {
  user_name = "eks"
}

data "aws_caller_identity" "current" {}

#
# addons terraform state
#
data "terraform_remote_state" "parachain_testnet" {
  backend = "s3"
  config = {
    role_arn = "arn:aws:iam::189013141504:role/jenkins-access"
    bucket   = "avn-testnet-tf-state"
    key      = "terraform.state"
    region   = "eu-west-1"
    encrypt  = true
  }
}