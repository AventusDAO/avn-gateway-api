output "gateway_secretsmanager_name" {
    value = module.aws_secretsmanager_secret.this.name
}

output "gateway_secretsmanager_arn" {
    value = module.aws_secretsmanager_secret.this.arn
}
