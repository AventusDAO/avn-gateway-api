locals {
  name                   = "avn-gateway"
  environment            = "cba"
  cluster_version        = "1.21"
  eks_node_size          = 20
  account_id             = "602004642405"
  avn_connector_endpoint = "http://avn-connector.${local.environment}.aventus.internal/"
  avn_votes_bucket       = "avn-votes-uat"
  block_explorer_url     = "https://index.dev.aventus.io"
  vault_recovery_window  = 0
}

module "api_gateway" {
  source           = "../../../modules/api-gateway"
  skeleton_gateway = true
}

module "dns" {
  source             = "../../../modules/dns"
  vpc_id             = data.terraform_remote_state.vpc.outputs.vpc_id
  environment        = local.environment
  api_gateway_url    = module.api_gateway.url
  api_gateway_id     = module.api_gateway.api_id
  api_gateway_stage  = module.api_gateway.stage_id

  providers = {
    aws         = aws
    aws.aventus = aws.aventus
  }
}

module "rabbitmq" {
  source          = "../../../modules/rabbitmq"
  vpc_id          = data.terraform_remote_state.vpc.outputs.vpc_id
  subnet_ids      = setunion(data.terraform_remote_state.vpc.outputs.private_subnets, data.terraform_remote_state.vpc.outputs.public_subnets)
  deployment_mode = "CLUSTER_MULTI_AZ"
}

data "aws_eks_cluster" "eks" {
  name = module.eks.cluster_id
}

data "aws_eks_cluster_auth" "eks" {
  name = module.eks.cluster_id
}

provider "kubernetes" {
  host                   = data.aws_eks_cluster.eks.endpoint
  cluster_ca_certificate = base64decode(data.aws_eks_cluster.eks.certificate_authority[0].data)
  token                  = data.aws_eks_cluster_auth.eks.token
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "17.24.0"

  cluster_version   = local.cluster_version
  cluster_name      = local.name
  vpc_id            = data.terraform_remote_state.vpc.outputs.vpc_id
  subnets           = data.terraform_remote_state.vpc.outputs.private_subnets
  enable_irsa       = true
  workers_role_name = local.name

  cluster_endpoint_private_access = true
  cluster_endpoint_public_access  = true

  node_groups = {
    avn-gateway = {
      create_launch_template = true

      disk_size       = local.eks_node_size
      disk_type       = "gp3"

      desired_capacity = 1
      max_capacity     = 10
      min_capacity     = 1

      instance_types = ["t3.medium"]
      capacity_type  = "ON_DEMAND"
      k8s_labels = {
        Environment = local.environment
        GithubRepo  = "avn-gateway-api"
        GithubOrg   = "Aventus-Network-Services"
      }
      update_config = {
        max_unavailable = 1
      }
    }
  }

  map_roles = [
    {
      rolearn  = "arn:aws:iam::${local.account_id}:role/AWSReservedSSO_AdministratorAccess_d1d8f8e0733b5134"
      username = "adminuser:{{SessionName}}"
      groups   = ["system:masters"]
    },
    {
      rolearn  = "arn:aws:iam::${local.account_id}:role/jenkins-access"
      username = "adminuser:{{SessionName}}"
      groups   = ["system:masters"]
    },
  ]
}

module "k8s_service_account_permissions" {
  source = "../../../modules/k8s-service-account-permissions"

  oidc_provider     = module.eks.oidc_provider_arn
  rabbit_secret_arn = module.rabbitmq.secret_arn

  depends_on = [
    module.eks
  ]
}

module "documentdb" {
  source = "../../../modules/documentdb"

  subnet_ids               = data.terraform_remote_state.vpc.outputs.private_subnets
  vpc_id                   = data.terraform_remote_state.vpc.outputs.vpc_id
  additional_whitelist_ips = [module.bastion.private_cidr]
}

module "redis" {
  source = "../../../modules/redis"

  vpc_id       = data.terraform_remote_state.vpc.outputs.vpc_id
  ip_whitelist = data.terraform_remote_state.vpc.outputs.private_subnet_ips
}