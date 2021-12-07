output "vpc_id" {
  value = aws_vpc.gateway.id
}

output "private_subnets" {
  value = [
    aws_subnet.private_subnets["a"].id,
    aws_subnet.private_subnets["b"].id,
    aws_subnet.private_subnets["c"].id
  ]
}

output "public_subnets" {
  value = [
    aws_subnet.public_subnets["a"].id,
    aws_subnet.public_subnets["b"].id,
    aws_subnet.public_subnets["c"].id
  ]
}

output "public_subnet_ips" {
  value = toset([
    for subnet in aws_subnet.public_subnets : subnet.cidr_block
  ])
}

output "private_subnet_ips" {
  value = toset([
    for subnet in aws_subnet.private_subnets : subnet.cidr_block
  ])
}

output "primary_subnet" {
  value = {
    ip                = var.private_zone_ips["a"]
    availability_zone = "${data.aws_region.current.name}a"
    id                = {for subnet in aws_subnet.private_subnets : subnet.cidr_block => subnet.id}[var.private_zone_ips["a"]]
  }
}
