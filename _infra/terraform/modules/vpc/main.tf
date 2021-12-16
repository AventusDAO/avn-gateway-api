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
    {"Name": "${var.name}-private-${each.key}"},
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
      {"Name": "${var.name}-public-${each.key}"},
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

resource "aws_vpc_peering_connection" "gateway_api" {
  for_each      = var.avn_vpc_id != "" ? ["avn-vpc"] : []
  peer_owner_id = var.avn_vpc_owner_id
  peer_vpc_id   = var.avn_vpc_id
  peer_region   = var.peer_region
  vpc_id        = aws_vpc.gateway.id
  auto_accept   = false

  tags = {
    Side = "Requester"
    Name = "gateway-api-to-avn"
  }
}

provider "aws" {
  alias  = "avn"
  region = var.peer_region

  assume_role {
    role_arn = "arn:aws:iam::${var.avn_vpc_owner_id}:role/jenkins-access"
  }
}

resource "aws_vpc_peering_connection_accepter" "peer" {
  for_each      = var.avn_vpc_id != "" ? ["accepter"] : []

  provider                  = aws.avn
  vpc_peering_connection_id = aws_vpc_peering_connection.gateway_api["avn-vpc"].id
  auto_accept               = true

  tags = {
    Side = "Accepter"
    Name = "gateway-api-to-avn"
  }
}

resource "aws_vpc_peering_connection_options" "requester" {
  for_each = var.avn_vpc_id != "" ? ["requester"] : []

  # As options can't be set until the connection has been accepted
  # create an explicit dependency on the accepter.
  vpc_peering_connection_id = aws_vpc_peering_connection_accepter.peer["accepter"].id

  requester {
    allow_remote_vpc_dns_resolution = var.enable_dns_hostnames
  }
}

resource "aws_vpc_peering_connection_options" "accepter" {
  for_each = var.avn_vpc_id != "" ? ["accepter"] : []

  provider = aws.avn

  vpc_peering_connection_id = aws_vpc_peering_connection_accepter.peer["accepter"].id

  accepter {
    allow_remote_vpc_dns_resolution = var.enable_dns_hostnames
  }
}

# private route table
resource "aws_route_table" "gateway" {
  vpc_id = aws_vpc.gateway.id

  tags = {
    Name = "gateway-api-private-routes"
  }
}

resource "aws_route" "gateway_to_avn" {
  route_table_id            = aws_route_table.gateway.id
  destination_cidr_block    = "10.90.0.0/19" #hard coded vpc from development, must be changed.
  vpc_peering_connection_id = aws_vpc_peering_connection.gateway_api.id
}

resource "aws_route_table_association" "gateway_to_avn" {
  for_each       = var.avn_vpc_id != "" ? var.private_zone_ips : {}
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

resource "aws_route" "public_subnets_to_avn_vpc" {
  for_each = var.avn_vpc_id != "" ? ["avn-route"] : []

  route_table_id            = aws_route_table.public_route_table.id
  destination_cidr_block    = "10.90.0.0/19" #hard coded vpc from development, must be changed.
  vpc_peering_connection_id = aws_vpc_peering_connection.gateway_api.id
}

# Allow public instances access to the internet
resource "aws_route" "internet_gateway" {
  gateway_id             = aws_internet_gateway.gateway.id
  destination_cidr_block = "0.0.0.0/0"
  route_table_id         = aws_route_table.public_route_table.id
}


resource "aws_route" "public_avn_to_gateway_private_subnets" {
  for_each = var.avn_vpc_id != "" ? var.private_zone_ips : {}

  provider                  = aws.avn
  route_table_id            = var.peer_public_route_table
  destination_cidr_block    = each.value
  vpc_peering_connection_id = aws_vpc_peering_connection_accepter.peer.id
}

resource "aws_route" "public_avn_to_gateway_public_subnets" {
  for_each = var.avn_vpc_id != "" ? var.public_zone_ips : {}

  provider                  = aws.avn
  route_table_id            = var.peer_public_route_table
  destination_cidr_block    = each.value
  vpc_peering_connection_id = aws_vpc_peering_connection_accepter.peer.id
}

resource "aws_route" "private_avn_to_gateway_private_subnets" {
  for_each = var.avn_vpc_id != "" ? var.private_zone_ips : {}

  provider                  = aws.avn
  route_table_id            = var.peer_private_route_table
  destination_cidr_block    = each.value
  vpc_peering_connection_id = aws_vpc_peering_connection_accepter.peer.id
}

resource "aws_route" "private_avn_subnets_to_public_gateway" {
  for_each = var.avn_vpc_id != "" ? var.public_zone_ips : {}

  provider                  = aws.avn
  route_table_id            = var.peer_private_route_table
  destination_cidr_block    = each.value
  vpc_peering_connection_id = aws_vpc_peering_connection_accepter.peer.id
}
