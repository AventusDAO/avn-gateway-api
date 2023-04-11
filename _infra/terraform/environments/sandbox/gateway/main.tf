locals {
  name                   = "avn-gateway"
  environment            = "sandbox"
  cluster_version        = "1.21"
  eks_node_size          = 20
  account_id             = "352429414196"
  avn_connector_endpoint = "http://avn-connector.${local.environment}.aventus.internal/"
  avn_votes_bucket       = "avn-votes-sandbox"
  vault_recovery_window  = 0
}
