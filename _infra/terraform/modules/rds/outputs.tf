output "gateway_secretsmanager" {
    value = module.aws_secretsmanager_secret.this.name
}
