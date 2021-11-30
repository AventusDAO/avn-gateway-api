locals {
  # https://www.terraform.io/docs/language/functions/cidrhost.html
  avn_connector_ip = cidrhost(data.aws_subnet.private_a.cidr_block, 20)
}

data "aws_subnet" "private_a" {
  filter {
    name   = "tag:Name"
    values = ["${var.vpc_name}-private-a"]
  }
}

resource "aws_route53_zone" "private" {
  name = "${var.environment}.aventus.internal"

  vpc {
    vpc_id = var.vpc_id
  }
}

resource "aws_route53_record" "avn_connector" {
  zone_id = aws_route53_zone.private.zone_id
  name    = "avn-connector.${var.environment}.aventus.internal"
  type    = "A"
  ttl     = "300"
  records = [local.avn_connector_ip]
}

resource "aws_eip" "avn_connector" {
  vpc = true

  associate_with_private_ip = local.avn_connector_ip
}