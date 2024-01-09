data "aws_caller_identity" "current" {}

#
# addons terraform state
#
data "terraform_remote_state" "parachain_testnet" {
  backend = "s3"
  config = {
    role_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/jenkins-access"
    bucket   = "avn-testnet-tf-state"
    key      = "terraform.state"
    region   = "eu-west-1"
    encrypt  = true
  }
}