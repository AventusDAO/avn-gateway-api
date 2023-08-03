locals {
  cluster_name   = "avn-gateway"
  vpc_cidr_block = "172.17.0.0/20"
  avn_vpc_id     = "vpc-074c6e19e26ba4a23"
}

module "vpc" {
  source         = "../../../modules/vpc"

  env = "dev"

  avn_vpc_id     = local.avn_vpc_id
  vpc_cidr_block = local.vpc_cidr_block

  private_zone_ips = {
    "a": "172.17.0.0/22",
    "b": "172.17.4.0/22",
    "c": "172.17.8.0/22"
  }

  public_zone_ips = {
    "a": "172.17.12.0/24",
    "b": "172.17.13.0/24",
    "c": "172.17.14.0/24"
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