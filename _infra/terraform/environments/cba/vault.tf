resource "aws_key_pair" "vault-ssh-key" {
  key_name   = "technical-account-vault"
  public_key = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDShHUS4gloN0Q5ATSHEwPCogmKIiVYNH3WUtmcmI4eyKt1yDmw7iQRHFpMK0rOISkBmCtor5kNdzuYjEXEIZryoEk4WeGCodXBGmMfVCAVi6Q6yc+0yABIFqcticyoKtndBmIIiSIZdy/66H3QvqgFxABoeOy98ja+QySmxNtVtI5ks1xkLYxINjuSGgNsA48tUWgfaUTENjBX8p9qff+iFygZalL7318mugzqMDOo3lfmu/mqy1/eKkEdNObHmBOZA341+HDA12L1Nd4Y9xnPNoZrjFQKxwe7+KT3C0NuMlVj0HdPkg6Yr6WT5eDEfqowPoofE+zgDC/f4hLdDE4i55fotGzMR50JTX2XGvEcRHYQtlu4+Ttirvrlt+3vyOUCxVjRQunwFfBTKa+v63tJjlJupS7MJefzVY4nRHEUSGPtOes5HvAS4HhjvojhHkFNY5hyNbqTXNvbvLjqtxN6ca690udEHBIaJ+ogoPhrB9VLN4vRKUHqcIQ0dOGEJ5a2qiodJJsgUqze65I+9xm2a7m8IAnSRKlHFm8ZfjBHqRciR4+MlqQcB3oKgNc0WRGt8GQktJr4DEY2bEwQWB1SRiftqPlp2x4xuok/1c+UDSu5cq56fU/EyfHNsarmL9TFmdDBraODNnaB6bAfAqHQNcRGSWD38G4hayyiXkN+Cw== technical-account-vault"
}

resource "aws_route53_zone" "avn-gw-vault" {
  name = "vault.${local.environment}.avn-gateway.aventus.io"
}

module "avn-vault-sandbox" {
  source = "git@github.com:Aventus-Network-Services/avn-vault-terraform-module.git?ref=v0.4.1"
  name = "${local.environment}"
  project = "avn-gateway"
  ssh-key = "technical-account-vault"
  avn-vault-vpc-cidr = module.vpc.primary_subnet.ip
  vpc-id = module.vpc.vpc_id
  subnet-id = module.vpc.primary_subnet.id
  availability_zone = module.vpc.primary_subnet.availability_zone
  aws-route53-zone = aws_route53_zone.avn-gw-vault.zone_id
  avn_vault_instance_type = "t3a.medium"
  # Since we are using a zone of a subdomain, we don't need to define one
  tls_cert_subdomain = ""
  dynamodb_table_name= "avn-gw-vault-${local.environment}-db"
}
