# Bastion Security Group
resource "aws_security_group" "avn-gw-bastion-sg" {
  name        = "avn-gw-bastion"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "TCP"
    cidr_blocks = var.ssh_allowed_ips
    description = "SSH access inside VPC"
  }

  egress {
    from_port       = 0
    to_port         = 0
    protocol        = "-1"
    cidr_blocks     = ["0.0.0.0/0"]
  }
  tags = {
    Name = "bastion-sg"
    Project = "AvN-Gateway"
  }
}

# Bastion Instance
resource "aws_instance" "avn-gw-bastion" {
  ami                    = var.ami_image_id
  instance_type          = "t3a.nano"
  key_name               = var.ssh_key_name
  monitoring             = true
  vpc_security_group_ids = [aws_security_group.avn-gw-bastion-sg.id]
  subnet_id              = var.public_subnet_id

  root_block_device {
    volume_size = "15"
    encrypted = "true"
  }

  tags = {
    Name = "bastion"
    Project = "AvN-Gateway"
  }
}
