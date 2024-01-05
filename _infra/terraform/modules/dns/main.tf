locals {
  # https://www.terraform.io/docs/language/functions/cidrhost.html
  public_zone_name = "${var.environment}.gateway.aventus.io"
}

provider "aws" {
}

provider "aws" {
  alias = "aventus"
}

resource "aws_route53_zone" "public" {
  name = local.public_zone_name
}

data "aws_route53_zone" "aventus_io" {
  provider = aws.aventus
  name     = "aventus.io."
}

resource "aws_route53_record" "aventus_io" {
  provider        = aws.aventus
  allow_overwrite = true
  name            = local.public_zone_name
  ttl             = 172800
  type            = "NS"
  zone_id         = data.aws_route53_zone.aventus_io.zone_id

  records = [
    aws_route53_zone.public.name_servers[0],
    aws_route53_zone.public.name_servers[1],
    aws_route53_zone.public.name_servers[2],
    aws_route53_zone.public.name_servers[3],
  ]
}

resource "aws_acm_certificate" "api_gateway" {
  domain_name       = aws_route53_zone.public.name
  validation_method = "DNS"

  tags = {
    Environment = var.environment
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "api_gateway_validation" {
  for_each = {
    for dvo in aws_acm_certificate.api_gateway.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = aws_route53_zone.public.zone_id
}

resource "aws_acm_certificate_validation" "api_gateway" {
  certificate_arn         = aws_acm_certificate.api_gateway.arn
  validation_record_fqdns = [for record in aws_route53_record.api_gateway_validation : record.fqdn]
}
