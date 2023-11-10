locals {
  environment           = "mainnet"
  vault_recovery_window = 0
}

module "dns" {
  source = "../../../modules/dns"

  vpc_id           = data.terraform_remote_state.vpc.outputs.vpc_id
  parachain_vpc_id = data.terraform_remote_state.parachain_mainnet.outputs.vpc_id
  environment      = local.environment

  providers = {
    aws         = aws
    aws.aventus = aws.aventus
  }
}

module "redis" {
  source = "../../../modules/redis"

  vpc_id                   = data.terraform_remote_state.vpc.outputs.vpc_id
  parachain_vpc_cidr_block = data.terraform_remote_state.parachain_mainnet.outputs.vpc_cidr_block
  ip_whitelist             = data.terraform_remote_state.vpc.outputs.private_subnet_ips
}
