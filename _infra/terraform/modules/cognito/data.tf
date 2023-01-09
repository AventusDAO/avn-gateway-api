data "aws_route53_zone" "domain" {
  name         = var.hosted_zone
  private_zone = false
}
