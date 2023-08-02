
locals {
  cluster_name   = "avn-gateway"
  vpc_cidr_block = "172.20.0.0/18"
}

module "vpc" {
  source = "../../../modules/vpc"

  env            = "mainnet"
  vpc_cidr_block = local.vpc_cidr_block

  private_zone_ips = {
    "a" : "172.20.0.0/20",
    "b" : "172.20.16.0/20",
    "c" : "172.20.32.0/20"
  }

  public_zone_ips = {
    "a" : "172.20.48.0/28",
    "b" : "172.20.49.0/28",
    "c" : "172.20.50.0/28"
  }

  private_subnet_additional_tags = {
    "kubernetes.io/cluster/${local.cluster_name}" = "shared"
    "kubernetes.io/role/internal-elb"             = "1"
  }

  public_subnet_additional_tags = {
    "kubernetes.io/cluster/${local.cluster_name}" = "shared"
    "kubernetes.io/role/elb"                      = "1"
  }
}
