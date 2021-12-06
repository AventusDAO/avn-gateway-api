resource "aws_security_group" "redis" {
  name = "redis-cluster"
  description = "Redis MemoryDB Security Group"
  vpc_id = var.vpc_id

  ingress {
    from_port = "6379"
    to_port = "6379"
    protocol = "tcp"
    cidr_blocks = var.ip_whitelist
  }

  egress {
    from_port = "0"
    to_port = "0"
    protocol = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "redis-cluster"
  }
}
