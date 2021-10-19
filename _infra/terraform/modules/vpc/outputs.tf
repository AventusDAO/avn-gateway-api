variable "vpc_id" {
  value = aws_vpc.gateway.id
}

variable "private_subnets" {
  value = toset([
    for subnet in aws_subnet.private_subnets : subnet.id
  ])
}

variable "public_subnets" {
  value = toset([
    for subnet in aws_subnet.public_subnets : subnet.id
  ])
}