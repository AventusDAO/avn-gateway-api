output "avn_connector_ips" {
  value = local.avn_connector_ips
}

output "public_zone_id" {
  value = aws_route53_zone.public.id
}

output "private_hosted_zone_id" {
  value = aws_route53_zone.private.id
}