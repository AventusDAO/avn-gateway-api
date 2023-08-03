module "gateway_rds" {
  source = "../../../modules/rds"

  subnet_ids               = data.terraform_remote_state.vpc.outputs.private_subnets
  vpc_id                   = data.terraform_remote_state.vpc.outputs.vpc_id
  parachain_vpc_cidr_block = data.terraform_remote_state.parachain_dev.outputs.vpc_cidr_block
}
