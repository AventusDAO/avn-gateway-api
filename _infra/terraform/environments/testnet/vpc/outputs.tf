output "main_subnet" {
  value = join(",", module.vpc.private_subnets)
}
