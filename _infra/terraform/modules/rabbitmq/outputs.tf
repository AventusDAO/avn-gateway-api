output "rabbit_security_group" {
  value = var.publicly_accessible ? null : aws_security_group.rabbit["private"].id
}