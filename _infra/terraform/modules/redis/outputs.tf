output "password" {
  sensitive = true
  value     = local.user.password
}

output "username" {
  sensitive = true
  value     = local.user.username
}

output "security_group_id" {
  value = aws_security_group.redis.id
}