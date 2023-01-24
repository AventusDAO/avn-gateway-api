output "gateway_secretsmanager_name" {
    value = aws_secretsmanager_secret.this.name
}

output "gateway_secretsmanager_arn" {
    value = aws_secretsmanager_secret.this.arn
}
