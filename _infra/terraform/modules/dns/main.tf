locals {
  # https://www.terraform.io/docs/language/functions/cidrhost.html
  avn_connector_ips = [
    cidrhost(data.aws_subnet.private["a"].cidr_block, 20),
    cidrhost(data.aws_subnet.private["b"].cidr_block, 20),
    cidrhost(data.aws_subnet.private["c"].cidr_block, 20)
  ]
  subnets = [
    data.aws_subnet.private["a"].id,
    data.aws_subnet.private["b"].id,
    data.aws_subnet.private["c"].id
  ]
  public_zone_name = "${var.environment}.avn-gateway.aventus.io"
}

provider "aws" {
}

provider "aws" {
  alias  = "aventus"
}

data "aws_subnet" "private" {
  for_each = toset(["a", "b", "c"])
  filter {
    name   = "tag:Name"
    values = ["${var.vpc_name}-private-${each.key}"]
  }
}

resource "aws_route53_zone" "private" {
  name = "${var.environment}.aventus.internal"

  vpc {
    vpc_id = var.vpc_id
  }
}

resource "aws_route53_zone" "public" {
  name = local.public_zone_name
}

data "aws_route53_zone" "aventus_io" {
  provider  = aws.aventus
  name      = "aventus.io."
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
  domain_name       = "api.${aws_route53_zone.public.name}"
  validation_method = "DNS"

  tags = {
    Environment = var.environment
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_apigatewayv2_domain_name" "api_gateway" {
  domain_name = "api.${aws_route53_zone.public.name}"

  domain_name_configuration {
    certificate_arn    = aws_acm_certificate.api_gateway.arn
    endpoint_type      = "REGIONAL"
    security_policy    = "TLS_1_2"
  }

  depends_on = [
    aws_acm_certificate.api_gateway,
    aws_acm_certificate_validation.api_gateway
  ]
}

resource "aws_apigatewayv2_api_mapping" "example" {
  api_id      = var.api_gateway_id
  domain_name = aws_apigatewayv2_domain_name.api_gateway.id
  stage       = var.api_gateway_stage
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

resource "aws_route53_record" "api_gateway" {
  zone_id = aws_route53_zone.public.zone_id
  name    = "api.${aws_route53_zone.public.name}"
  type    = "A"
  
  alias {
    name                   = aws_apigatewayv2_domain_name.api_gateway.domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.api_gateway.domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "avn_connector" {
  zone_id = aws_route53_zone.private.zone_id
  name    = "avn-connector.${aws_route53_zone.private.name}"
  type    = "A"
  ttl     = "300"
  records = local.avn_connector_ips
}

resource "aws_route53_record" "rabbit" {
  zone_id = aws_route53_zone.private.zone_id
  name    = "rabbit.${aws_route53_zone.private.name}"
  type    = "CNAME"
  ttl     = "300"
  records = [var.rabbit_address]
}

resource "aws_route53_record" "documentdb" {
  zone_id = aws_route53_zone.private.zone_id
  name    = "documentdb.${aws_route53_zone.private.name}"
  type    = "CNAME"
  ttl     = "300"
  records = [var.documentdb_address]
}