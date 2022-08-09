locals {
  name                   = "avn-gateway"
  environment            = "testnet"
  cluster_version        = "1.21"
  eks_node_size          = 50
  account_id             = "189013141504"
  avn_connector_endpoint = "http://avn-connector.${local.environment}.aventus.internal/"
  avn_votes_bucket       = "avn-votes-testnet"
  block_explorer_url     = "https://testnet.index.aventus.io:3000"
  vault_recovery_window  = 0
}

resource "aws_iam_policy" "full_access_vote_buckets" {
  name        = "vote_bucket_access"
  description = "full access to vote bucket with name ${local.avn_votes_bucket}"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "s3:GetObject",
        ]
        Resource = "arn:aws:s3:::${local.avn_votes_bucket}"
      },
    ]
        Statement = [
      {
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = "arn:aws:s3:::${local.avn_votes_bucket}/*"
      },
    ]
  })
}

data "aws_lambda_function" "vote_handler" {
  function_name = "vote-handler"

  depends_on = [
    module.lambda_functions
  ]
}

resource "aws_iam_role_policy_attachment" "extra_permissions" {
  role       = data.aws_lambda_function.vote_handler.role
  policy_arn = aws_iam_policy.full_access_vote_buckets.arn
}

module "lambda_functions" {
  source                 = "../../../modules/lambda"
  artifact_bucket        = "avn-lambda-artifacts-sandbox"
  log_retention_period   = 7
  service_version        = var.service_version
  rabbit_secret_arn      = module.rabbitmq.secret_arn
  avn_connector_endpoint = local.avn_connector_endpoint
  subnet_ids             = data.terraform_remote_state.vpc.outputs.private_subnets
  vpc_id                 = data.terraform_remote_state.vpc.outputs.vpc_id

  lambda_functions = {
    authorisation-handler = {
      env_vars = {
        MAX_TOKEN_AGE_MSEC     = 60000
        MIN_AVT_BALANCE        = "1000000000000000000"
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
    lift-processing-handler = {
      env_vars = {
        MQ_BROKER_AMQP_ENDPOINT = module.rabbitmq.broker_endpoint
        MQ_SECRET_ARN           = module.rabbitmq.secret_arn
        MQ_AVN_TX_QUEUE         = "avnTx"
        SECRET_MANAGER_REGION   = var.region
      }
      timeout     = 6
      memory_size = 128
    }
    tx-status-update-handler = {
      env_vars = {
        BLOCK_EXPLORER_BASE_URL = local.block_explorer_url
      }
    }
    stakers-payout-handler = {
      env_vars = {
        MQ_BROKER_AMQP_ENDPOINT = module.rabbitmq.broker_endpoint
        MQ_SECRET_ARN           = module.rabbitmq.secret_arn
        MQ_AVN_TX_QUEUE         = "avnTx"
        SECRET_MANAGER_REGION   = var.region
      }
      timeout     = 6
      memory_size = 128
    }
    vote-handler = {
      env_vars = {
        AVN_VOTES_BUCKET = local.avn_votes_bucket
      }
      memory_size = 256
      extra_policy_arn = aws_iam_policy.full_access_vote_buckets.arn
    }
  }

  depends_on = [
    module.rabbitmq
  ]
}

module "api_gateway" {
  source                = "../../../modules/api-gateway"
  authoriser_invoke_arn = module.lambda_functions.invoke_arns["authorisation-handler"]
  authoriser_arn        = module.lambda_functions.lambda_arns["authorisation-handler"]
  poll_invoke_arn       = module.lambda_functions.invoke_arns["poll-handler"]
  send_invoke_arn       = module.lambda_functions.invoke_arns["send-handler"]
  query_invoke_arn      = module.lambda_functions.invoke_arns["query-handler"]
  vote_invoke_arn       = module.lambda_functions.invoke_arns["vote-handler"]
  auth_cache_duration   = 60
}

module "dns" {
  source          = "../../../modules/dns"
  vpc_id          = data.terraform_remote_state.vpc.outputs.vpc_id
  environment     = local.environment
  api_gateway_url = module.api_gateway.url
  api_gateway_id  = module.api_gateway.api_id
  api_gateway_stage = module.api_gateway.stage_id

  providers = {
    aws         = aws
    aws.aventus = aws.aventus
  }
}

module "rabbitmq" {
  source          = "../../../modules/rabbitmq"
  vpc_id          = data.terraform_remote_state.vpc.outputs.vpc_id
  subnet_ids      = data.terraform_remote_state.vpc.outputs.private_subnets
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
  source          = "terraform-aws-modules/eks/aws"
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

      desired_capacity = 5
      max_capacity     = 50
      min_capacity     = 5

      instance_types = ["t3.medium"]
      capacity_type  = "ON_DEMAND"
      k8s_labels = {
        Environment = local.environment
        GithubRepo  = "avn-gateway-api"
        GithubOrg   = "Aventus-Network-Services"
      }
      update_config = {
        max_unavailable = 3
      }
    }
  }

  map_roles = [
    {
      rolearn  = "arn:aws:iam::${local.account_id}:role/AWSReservedSSO_AdministratorAccess_0ca933a60f79db9c"
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
    module.eks,
    module.lambda_functions
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