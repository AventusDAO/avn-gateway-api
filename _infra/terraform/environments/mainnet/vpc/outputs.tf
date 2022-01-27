output "private_subnets_string" {
  value = join(",", module.vpc.private_subnets)
}

output "private_subnets" {
  value = module.vpc.private_subnets
}

output "private_subnet_ips" {
  value = module.vpc.private_subnet_ips
}

output "public_subnets" {
  value = module.vpc.public_subnets
}

output "public_subnet_ips" {
  value = module.vpc.public_subnet_ips
}

output "vpc_id" {
  value = module.vpc.vpc_id
}

output "primary_private_subnet" {
  value = module.vpc.primary_private_subnet
}

output "primary_public_subnet" {
  value = module.vpc.primary_public_subnet
}

output "vpc_cidr_block" {
  value = local.vpc_cidr_block
}