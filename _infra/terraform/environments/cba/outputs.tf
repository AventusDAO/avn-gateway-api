output "avn_connector_ips" {
  value = join(",", module.dns.avn_connector_ips)
}

output "main_subnet" {
  value = module.vpc.private_subnets[0]
}