module "ecr" {
  source           = "../../../modules/ecr"
  project_name     = "gateway-api"
  ecr_repositories = ["avn-connector", "relayer-account", "relayer-fees"]
  account_ids      = var.account_ids
}
