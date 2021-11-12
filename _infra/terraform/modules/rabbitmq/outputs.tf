output "rabbit_security_group" {
  value = var.publicly_accessible ? null : aws_security_group.rabbit["private"].id
}

output "secret_arn" {
  value = aws_secretsmanager_secret.rabbit.arn
}

output "broker_endpoint" {
  value = aws_mq_broker.gateway.instances.0.endpoints.0
}