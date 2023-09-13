locals {
  name                  = "avn-gateway"
  environment           = "cba"
  cluster_version       = "1.21"
  eks_node_size         = 20
  account_id            = "602004642405"
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

module "rabbitmq" {
  source = "../../../modules/rabbitmq"

  vpc_id                   = data.terraform_remote_state.vpc.outputs.vpc_id
  parachain_vpc_cidr_block = data.terraform_remote_state.parachain_dev.outputs.vpc_cidr_block
  subnet_ids               = setunion(data.terraform_remote_state.vpc.outputs.private_subnets, data.terraform_remote_state.vpc.outputs.public_subnets)
  deployment_mode          = "CLUSTER_MULTI_AZ"
}

module "documentdb" {
  source = "../../../modules/documentdb"

  subnet_ids               = data.terraform_remote_state.vpc.outputs.private_subnets
  vpc_id                   = data.terraform_remote_state.vpc.outputs.vpc_id
  additional_whitelist_ips = [module.bastion.private_cidr]
}

module "redis" {
  source = "../../../modules/redis"

  vpc_id                   = data.terraform_remote_state.vpc.outputs.vpc_id
  parachain_vpc_cidr_block = data.terraform_remote_state.parachain_dev.outputs.vpc_cidr_block
  ip_whitelist             = data.terraform_remote_state.vpc.outputs.private_subnet_ips
}