
locals {
  name            = "stargate"
  cluster_version = "1.21"
  region          = "eu-west-1"
  account_id      = "352429414196"
}

module "lambda_functions" {
  source               = "../../modules/lambda"
  region               = var.region
  artifact_bucket      = "avn-lambda-artifacts-sandbox"
  log_retention_period = 1
  service_version      = var.service_version

  lambda_functions = {
    authorisation-handler = {
      env_vars = {
        MAX_TOKEN_AGE_MSEC = 60000
        MIN_AVT_BALANCE    = "100000000000000000000"
      }
    }
    send-handler = {}
    poll-handler  = {}
    query-handler = {}
  }
}

module "avn-gateway-api" {
  source                = "../../modules/api-gateway"
  authoriser_invoke_arn = module.lambda_functions.invoke_arns["authorisation-handler"]
  authoriser_arn        = module.lambda_functions.lambda_arns["authorisation-handler"]
  poll_invoke_arn       = module.lambda_functions.invoke_arns["poll-handler"]
  send_invoke_arn       = module.lambda_functions.invoke_arns["send-handler"]
  query_invoke_arn      = module.lambda_functions.invoke_arns["query-handler"]
  auth_cache_duration   = 60
}

module "vpc" {
  source                   = "../../modules/vpc"
  avn_vpc_id               = "vpc-074c6e19e26ba4a23"
  peer_public_route_table  = "rtb-0a0b61707b33e0a75"
  peer_private_route_table = "rtb-00b575bea946b34bc"

  private_subnet_additional_tags = {
    "kubernetes.io/cluster/${local.name}" = "shared"
    "kubernetes.io/role/internal-elb"     = "1"
  }

  public_subnet_additional_tags = {
    "kubernetes.io/cluster/${local.name}" = "shared"
    "kubernetes.io/role/elb"              = "1"
  }
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
  source          = "terraform-aws-modules/eks/aws"

  cluster_version = local.cluster_version
  cluster_name    = local.name
  vpc_id          = module.vpc.vpc_id
  subnets         = module.vpc.private_subnets

  cluster_endpoint_private_access = true
  cluster_endpoint_public_access  = true

  node_groups = {
    stargate = {
      create_launch_template = true

      disk_size       = 20
      disk_type       = "gp3"

      desired_capacity = 1
      max_capacity     = 10
      min_capacity     = 1

      instance_types = ["t3.medium"]
      capacity_type  = "ON_DEMAND"
      k8s_labels = {
        Environment = "sandbox"
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
      rolearn  = "arn:aws:iam::${local.account_id}:role/AWSReservedSSO_AdministratorAccess_a2b4587f5d23a564"
      username = "adminuser:{{SessionName}}"
      groups   = ["system:masters"]
    },
  ]
}
