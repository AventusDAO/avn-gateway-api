
locals {
  name       = "avn-gateway"
  account_id = "602004642405"
}

module "lambda_functions" {
  source               = "../../modules/lambda"
  artifact_bucket      = "avn-lambda-artifacts-sandbox"
  log_retention_period = 1
  service_version      = var.service_version
  rabbit_secret_arn    = module.rabbitmq.secret_arn

  lambda_functions = {
    authorisation-handler = {
      env_vars = {
        MAX_TOKEN_AGE_MSEC = 60000
        MIN_AVT_BALANCE    = "100000000000000000000"
      }
    }
    send-handler = {
      subnet_ids         = module.vpc.private_subnets
      security_group_ids = [module.rabbitmq.rabbit_security_group]
      env_vars           = {
        MQ_BROKER_AMQP_ENDPOINT = module.rabbitmq.broker_endpoint
        MQ_SECRET_ARN           = module.rabbitmq.secret_arn
        MQ_AVN_TX_QUEUE         = "avnTx"
        SECRET_MANAGER_REGION   = var.region
      }
    }
    poll-handler  = {}
    query-handler = {}
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
  vpc_cidr_block           = "172.17.0.0/20"

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
    "kubernetes.io/cluster/${local.name}" = "shared"
    "kubernetes.io/role/internal-elb"     = "1"
  }

  public_subnet_additional_tags = {
    "kubernetes.io/cluster/${local.name}" = "shared"
    "kubernetes.io/role/elb"              = "1"
  }
}

module "rabbitmq" {
  source          = "../../modules/rabbitmq"
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnets
  deployment_mode = "CLUSTER_MULTI_AZ"
  depends_on = [
    module.vpc
  ]
}
