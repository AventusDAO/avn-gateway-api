locals {
  ssh_allowed_ips = [
    "31.185.206.69/32",     # Thanos
    "81.111.99.54/32",      # John Terry
    "82.6.143.25/32",       # Nahu
    "18.135.167.38/32",     # IP of the nat of Testnet (Jenkins)
  ]
}

resource "aws_key_pair" "vault-ssh-key" {
  key_name   = "technical-account-vault"
  public_key = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDShHUS4gloN0Q5ATSHEwPCogmKIiVYNH3WUtmcmI4eyKt1yDmw7iQRHFpMK0rOISkBmCtor5kNdzuYjEXEIZryoEk4WeGCodXBGmMfVCAVi6Q6yc+0yABIFqcticyoKtndBmIIiSIZdy/66H3QvqgFxABoeOy98ja+QySmxNtVtI5ks1xkLYxINjuSGgNsA48tUWgfaUTENjBX8p9qff+iFygZalL7318mugzqMDOo3lfmu/mqy1/eKkEdNObHmBOZA341+HDA12L1Nd4Y9xnPNoZrjFQKxwe7+KT3C0NuMlVj0HdPkg6Yr6WT5eDEfqowPoofE+zgDC/f4hLdDE4i55fotGzMR50JTX2XGvEcRHYQtlu4+Ttirvrlt+3vyOUCxVjRQunwFfBTKa+v63tJjlJupS7MJefzVY4nRHEUSGPtOes5HvAS4HhjvojhHkFNY5hyNbqTXNvbvLjqtxN6ca690udEHBIaJ+ogoPhrB9VLN4vRKUHqcIQ0dOGEJ5a2qiodJJsgUqze65I+9xm2a7m8IAnSRKlHFm8ZfjBHqRciR4+MlqQcB3oKgNc0WRGt8GQktJr4DEY2bEwQWB1SRiftqPlp2x4xuok/1c+UDSu5cq56fU/EyfHNsarmL9TFmdDBraODNnaB6bAfAqHQNcRGSWD38G4hayyiXkN+Cw== technical-account-vault"
}

module "avn-vault-sandbox" {
  source = "git@github.com:Aventus-Network-Services/avn-vault-terraform-module.git?ref=v0.4.1"
  name = "Sandbox"
  project = "avn-gateway"
  ssh-key = "technical-account-vault"
  avn-vault-vpc-cidr = local.vpc_cidr_block
  vpc-id = module.vpc.vpc_id
  subnet-id = module.vpc.primary_private_subnet.id
  availability_zone = module.vpc.primary_private_subnet.availability_zone
  aws-route53-zone = module.dns.public_zone_id
  avn_vault_instance_type = "t3a.medium"
  tls_cert_subdomain = "vault"
  dynamodb_table_name= "avn-gw-vault-sandbox-db"
}

resource "local_file" "avn-gateway-vault-instance-file" {
    content     = <<-EOD
[vault-sandbox]
${module.avn-vault-sandbox.instance_ip_addr} ansible_user=ubuntu
EOD
    filename = "${path.module}/vault.inventory"
}

# TODO Create the Vault certificate using AWS in the dns module.

# Bastion Security Group
resource "aws_security_group" "avn-gw-bastion-sg" {
  name        = "avn-gw-bastion"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "TCP"
    cidr_blocks = local.ssh_allowed_ips
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

# Avn-Vault Instance
resource "aws_instance" "avn-gw-bastion" {
  ami                    = "ami-08edbb0e85d6a0a07"
  instance_type          = "t4g.nano"
  key_name               = aws_key_pair.vault-ssh-key.key_name
  monitoring             = true
  vpc_security_group_ids = [aws_security_group.avn-gw-bastion-sg.id]
  subnet_id              = module.vpc.primary_public_subnet.id

  root_block_device {
    volume_size = "15"
    encrypted = "true"
  }

  tags = {
    Name = "bastion-t4g"
    Project = "AvN-Gateway"
  }
}
