data "aws_region" "current" {}

resource "aws_vpc" "gateway" {
  cidr_block           = var.vpc_cidr_block
  instance_tenancy     = var.instance_tenancy
  enable_dns_hostnames = var.enable_dns_hostnames

  tags = {
    Name = var.name
  }
}

resource "aws_subnet" "private_subnets" {
  for_each          = var.private_zone_ips
  availability_zone = "${data.aws_region.current.name}${each.key}"
  vpc_id            = aws_vpc.gateway.id
  cidr_block        = each.value

  tags = merge(
    { "Name" : "${var.name}-private-${each.key}" },
    var.private_subnet_additional_tags
  )
}

resource "aws_subnet" "public_subnets" {
  for_each                = var.public_zone_ips
  availability_zone       = "${data.aws_region.current.name}${each.key}"
  vpc_id                  = aws_vpc.gateway.id
  cidr_block              = each.value
  map_public_ip_on_launch = true

  tags = merge(
    { "Name" : "${var.name}-public-${each.key}" },
    var.public_subnet_additional_tags
  )
}

resource "aws_eip" "gateway" {
  vpc = true
}

resource "aws_nat_gateway" "gateway" {
  connectivity_type = "public"
  allocation_id     = aws_eip.gateway.id
  subnet_id         = aws_subnet.public_subnets["a"].id

  tags = {
    Name = "gateway-api"
  }

  depends_on = [aws_internet_gateway.gateway]
}

resource "aws_internet_gateway" "gateway" {
  vpc_id = aws_vpc.gateway.id

  tags = {
    Name = "gateway-api"
  }
}

provider "aws" {
  alias  = "avn"
  region = var.peer_region

  assume_role {
    role_arn = "arn:aws:iam::${var.avn_vpc_owner_id}:role/jenkins-access"
  }
}

# private route table
resource "aws_route_table" "gateway" {
  vpc_id = aws_vpc.gateway.id

  tags = {
    Name = "gateway-api-private-routes"
  }
}

resource "aws_route_table_association" "private_subnets" {
  for_each       = var.private_zone_ips
  subnet_id      = aws_subnet.private_subnets[each.key].id
  route_table_id = aws_route_table.gateway.id
}

# Allow private instances access to the internet
resource "aws_route" "nat_gateway" {
  nat_gateway_id         = aws_nat_gateway.gateway.id
  destination_cidr_block = "0.0.0.0/0"
  route_table_id         = aws_route_table.gateway.id
}

# public route table
resource "aws_route_table" "public_route_table" {
  vpc_id = aws_vpc.gateway.id

  tags = {
    Name = "gateway-api-public-routes"
  }
}

resource "aws_route_table_association" "public_subnets" {
  for_each       = var.public_zone_ips
  subnet_id      = aws_subnet.public_subnets[each.key].id
  route_table_id = aws_route_table.public_route_table.id
}

# Allow public instances access to the internet
resource "aws_route" "internet_gateway" {
  gateway_id             = aws_internet_gateway.gateway.id
  destination_cidr_block = "0.0.0.0/0"
  route_table_id         = aws_route_table.public_route_table.id
}

#
# vpc peering accepter from parachain eu-west-1
#
resource "aws_vpc_peering_connection_accepter" "addons" {
  vpc_peering_connection_id = data.terraform_remote_state.addons.outputs.vpc_peering_connection_id_gateway
  auto_accept               = true

  tags = {
    Name = "VPC Peering between ${var.env} parachain and ${var.env} gateway eu-west-1"
  }
}

resource "aws_route" "gateway_eu_west_1" {
  count = length(data.aws_route_tables.gateway.ids)

  route_table_id            = tolist(data.aws_route_tables.gateway.ids)[count.index]
  destination_cidr_block    = data.terraform_remote_state.addons.outputs.vpc_cidr_block
  vpc_peering_connection_id = aws_vpc_peering_connection_accepter.addons.id
}
