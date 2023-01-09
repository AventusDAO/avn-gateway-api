module "gateway_rds" {
  source = "../../../modules/rds"

  subnet_ids              = data.terraform_remote_state.vpc.outputs.private_subnets
  vpc_id                  = data.terraform_remote_state.vpc.outputs.vpc_id
  backup_retention_period = null
}
