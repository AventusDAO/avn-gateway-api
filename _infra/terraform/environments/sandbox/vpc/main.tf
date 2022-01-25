locals {
  cluster_name   = "avn-gateway"
  avn_vpc_id     = "vpc-074c6e19e26ba4a23"
  vpc_cidr_block = "172.16.0.0/20"
}

module "vpc" {
  source         = "../../modules/vpc"
  avn_vpc_id     = local.avn_vpc_id
  vpc_cidr_block = local.vpc_cidr_block

  private_subnet_additional_tags = {
    "kubernetes.io/cluster/${local.cluster_name}" = "shared"
    "kubernetes.io/role/internal-elb"             = "1"
  }

  public_subnet_additional_tags = {
    "kubernetes.io/cluster/${local.cluster_name}" = "shared"
    "kubernetes.io/role/elb"                      = "1"
  }
}
