resource "aws_vpc" "gateway" {
  cidr_block           = var.vpc_cidr_block
  instance_tenancy     = var.instance_tenancy
  enable_dns_hostnames = var.enable_dns_hostnames

  tags = {
    Name = var.name
  }
}

resource "aws_subnet" "private_subnets" {
  for_each   = var.private_zone_ips
  vpc_id     = aws_vpc.gateway.id
  cidr_block = each.value

  tags = {
    Name = "${var.name}-private-${each.key}"
  }
}

resource "aws_subnet" "public_subnets" {
  for_each   = var.public_zone_ips
  vpc_id     = aws_vpc.gateway.id
  cidr_block = each.value

  tags = {
    Name = "${var.name}-public-${each.key}"
  }
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
  peer_owner_id = var.avn_vpc_owner_id
  peer_vpc_id   = var.avn_vpc_id
  peer_region   = var.peer_region
  vpc_id        = aws_vpc.gateway.id
  auto_accept   = true

  requester {
    allow_remote_vpc_dns_resolution = var.enable_dns_hostnames
  }

  tags = {
    "Side" = "Requester"
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
  provider                  = aws.avn
  vpc_peering_connection_id = aws_vpc_peering_connection.gateway_api.id
  auto_accept               = true

  tags = {
    Side = "Accepter"
  }
}
