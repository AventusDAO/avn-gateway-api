
module "lambda_functions" {
  source               = "../../modules/lambda"
  region               = var.region
  artifact_bucket      = "avn-lambda-artifacts-sandbox"
  log_retention_period = 1
}

module "avn-gateway-api" {
  source                = "../../modules/api-gateway"
  authoriser_invoke_arn = module.lambda_functions.invoke_arns["authorisation-handler"]
  authoriser_arn        = module.lambda_functions.lambda_arns["authorisation-handler"]
  poll_invoke_arn       = module.lambda_functions.invoke_arns["poll-handler"]
  send_invoke_arn       = module.lambda_functions.invoke_arns["send-handler"]
  query_invoke_arn      = module.lambda_functions.invoke_arns["query-handler"]
}

module "vpc" {
  source                   = "../../modules/vpc"
  avn_vpc_id               = "vpc-074c6e19e26ba4a23"
  peer_public_route_table  = "rtb-0a0b61707b33e0a75"
  peer_private_route_table = "rtb-00b575bea946b34bc"
}
