output "redis_password" {
  sensitive = true
  value     = module.redis.password
}

output "redis_username" {
  sensitive = true
  value     = module.redis.username
}

output "redis_security_group_id" {
  value = module.redis.security_group_id
}

output "private_hosted_zone_id" {
  value = module.dns.private_hosted_zone_id
}

#
# SQS
#

output "queue_arn" {
  value = module.gateway_sqs.queue_arn
}

output "queue_name" {
  value = module.gateway_sqs.queue_name
}

output "queue_url" {
  value = module.gateway_sqs.queue_url
}
