###############################
# TLS Certificate for cognito #
###############################
module "gateway_cognito_acm" {
  source  = "terraform-aws-modules/acm/aws"
  version = "4.3.1"

  domain_name = "*.${local.gateway_url}"
  zone_id     = module.dns.public_zone_id

  wait_for_validation = true

  tags = {
    Name        = "Cognito gateway certificate"
    Description = "Managed via terraform"
    Project     = "Gateway"
  }

  providers = {
    aws = aws.us_east_1
  }
}

#####################
# user pool and app #
#####################
module "gateway_cognito" {
  source = "../../../modules/cognito"

  hosted_zone            = local.gateway_url
  domain                 = "auth.${local.gateway_url}"
  callback_urls          = ["https://admin-gateway.dev.aventus.io/payerAdmin", "http://localhost:3007/payerAdmin"]
  logout_urls            = ["https://admin-gateway.dev.aventus.io/payerLogout", "http://localhost:3007/payerLogout"]
  domain_certificate_arn = module.gateway_cognito_acm.acm_certificate_arn
}