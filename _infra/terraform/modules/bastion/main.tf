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

data "aws_ami" "ubuntu_20_04" {
  most_recent = true

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-focal-20.04-amd64-server-20210430"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  owners = ["099720109477"] # Canonical
}

# Bastion Instance
resource "aws_instance" "avn-gw-bastion" {
  ami                    = data.aws_ami.ubuntu_20_04.image_id
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
