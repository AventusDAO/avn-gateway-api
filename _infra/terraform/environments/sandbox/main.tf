locals {
  name                   = "avn-gateway"
  environment            = "sandbox"
  cluster_version        = "1.21"
  eks_node_size          = 20
  account_id             = "352429414196"
  avn_connector_endpoint = "http://avn-connector.${local.environment}.aventus.internal/"
  block_explorer_url     = "https://avn.stargate.aventus.io:3000"
  vpc_cidr_block         = "172.16.0.0/20"
  vault_recovery_window  = 0
}

module "lambda_functions" {
  source                 = "../../modules/lambda"
  artifact_bucket        = "avn-lambda-artifacts-sandbox"
  log_retention_period   = 1
  service_version        = var.service_version
  rabbit_secret_arn      = module.rabbitmq.secret_arn
  avn_connector_endpoint = local.avn_connector_endpoint
  subnet_ids             = module.vpc.private_subnets
  vpc_id                 = module.vpc.vpc_id

  lambda_functions = {
    authorisation-handler = {
      env_vars = {
        MAX_TOKEN_AGE_MSEC     = 60000
        MIN_AVT_BALANCE        = "100000000000000000000"
      }
      memory_size = 512
    }
    send-handler = {
      env_vars = {
        MQ_BROKER_AMQP_ENDPOINT = module.rabbitmq.broker_endpoint
        MQ_SECRET_ARN           = module.rabbitmq.secret_arn
        MQ_AVN_TX_QUEUE         = "avnTx"
        SECRET_MANAGER_REGION   = var.region
      }
      timeout     = 4
      memory_size = 512
    }
    poll-handler = {
      timeout     = 4
      memory_size = 256
    }
    query-handler = {
      memory_size = 256
    }
    tx-status-update-handler = {
      env_vars = {
        BLOCK_EXPLORER_BASE_URL = local.block_explorer_url
      }
    }
  }

  depends_on = [
    module.vpc,
    module.rabbitmq
  ]
}

module "api_gateway" {
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
  vpc_cidr_block           = local.vpc_cidr_block

  private_subnet_additional_tags = {
    "kubernetes.io/cluster/${local.name}" = "shared"
    "kubernetes.io/role/internal-elb"     = "1"
  }

  public_subnet_additional_tags = {
    "kubernetes.io/cluster/${local.name}" = "shared"
    "kubernetes.io/role/elb"              = "1"
  }
}

module "dns" {
  source             = "../../modules/dns"
  vpc_id             = module.vpc.vpc_id
  environment        = local.environment
  rabbit_address     = module.rabbitmq.broker_address
  documentdb_address = module.documentdb.address
  api_gateway_url    = module.api_gateway.url
  api_gateway_id     = module.api_gateway.api_id
  api_gateway_stage  = module.api_gateway.stage_id

  providers = {
    aws         = aws
    aws.aventus = aws.aventus
  }
}

module "rabbitmq" {
  source          = "../../modules/rabbitmq"
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = setunion(module.vpc.private_subnets, module.vpc.public_subnets)
  depends_on = [
    module.vpc
  ]
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
  version = "17.24.0"

  cluster_version   = local.cluster_version
  cluster_name      = local.name
  vpc_id            = module.vpc.vpc_id
  subnets           = module.vpc.private_subnets
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
      rolearn  = "arn:aws:iam::${local.account_id}:role/AWSReservedSSO_AdministratorAccess_a2b4587f5d23a564"
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
  source = "../../modules/k8s-service-account-permissions"

  oidc_provider     = module.eks.oidc_provider_arn
  rabbit_secret_arn = module.rabbitmq.secret_arn

  depends_on = [
    module.eks,
    module.lambda_functions
  ]
}

module "documentdb" {
  source = "../../modules/documentdb"

  subnet_ids               = module.vpc.private_subnets
  vpc_id                   = module.vpc.vpc_id
  additional_whitelist_ips = [module.bastion.private_cidr]
}

module "redis" {
  source = "../../modules/redis"

  vpc_id       = module.vpc.vpc_id
  ip_whitelist = module.vpc.private_subnet_ips
}