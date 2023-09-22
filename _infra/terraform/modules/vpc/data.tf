data "aws_caller_identity" "current" {}


data "aws_route_tables" "gateway" {
  vpc_id = aws_vpc.gateway.id
}

#
# addons terraform state
#
data "terraform_remote_state" "addons" {
  backend = "s3"
  config = {
    role_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/jenkins-access"
    bucket   = "avn-${var.env}-tf-state"
    key      = "terraform.state"
    region   = "eu-west-1"
    encrypt  = true
  }
}