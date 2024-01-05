locals {
  environment           = "cba"
  vault_recovery_window = 0
}

module "dns" {
  source = "../../../modules/dns"

  vpc_id           = data.terraform_remote_state.vpc.outputs.vpc_id
  parachain_vpc_id = data.terraform_remote_state.parachain_dev.outputs.vpc_id
  environment      = local.environment

  providers = {
    aws         = aws
    aws.aventus = aws.aventus
  }
}