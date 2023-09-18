locals {
  # TODO only leave the Jenkins nat ip.
  ssh_allowed_ips = [
    "18.135.167.38/32",  # IP of the nat of Testnet (Jenkins)
    "86.126.81.150/32",  # Vuko
    "109.101.202.38/32", # Vuko
    "94.60.55.242/32",   # Rui
    "82.6.48.63/32",     # Nahu
    "84.68.228.205/32"   # Alex
  ]
}

resource "aws_key_pair" "vault-ssh-key" {
  key_name   = "technical-account-vault"
  public_key = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDShHUS4gloN0Q5ATSHEwPCogmKIiVYNH3WUtmcmI4eyKt1yDmw7iQRHFpMK0rOISkBmCtor5kNdzuYjEXEIZryoEk4WeGCodXBGmMfVCAVi6Q6yc+0yABIFqcticyoKtndBmIIiSIZdy/66H3QvqgFxABoeOy98ja+QySmxNtVtI5ks1xkLYxINjuSGgNsA48tUWgfaUTENjBX8p9qff+iFygZalL7318mugzqMDOo3lfmu/mqy1/eKkEdNObHmBOZA341+HDA12L1Nd4Y9xnPNoZrjFQKxwe7+KT3C0NuMlVj0HdPkg6Yr6WT5eDEfqowPoofE+zgDC/f4hLdDE4i55fotGzMR50JTX2XGvEcRHYQtlu4+Ttirvrlt+3vyOUCxVjRQunwFfBTKa+v63tJjlJupS7MJefzVY4nRHEUSGPtOes5HvAS4HhjvojhHkFNY5hyNbqTXNvbvLjqtxN6ca690udEHBIaJ+ogoPhrB9VLN4vRKUHqcIQ0dOGEJ5a2qiodJJsgUqze65I+9xm2a7m8IAnSRKlHFm8ZfjBHqRciR4+MlqQcB3oKgNc0WRGt8GQktJr4DEY2bEwQWB1SRiftqPlp2x4xuok/1c+UDSu5cq56fU/EyfHNsarmL9TFmdDBraODNnaB6bAfAqHQNcRGSWD38G4hayyiXkN+Cw== technical-account-vault"
}

resource "aws_secretsmanager_secret" "vault" {
  name                    = "vault"
  recovery_window_in_days = local.vault_recovery_window
}

module "avn-vault" {
  source                   = "git@github.com:Aventus-Network-Services/avn-vault-infrastructure//terraform-module/avn-vault?ref=2.1.0"
  name                     = local.environment
  project                  = "avn-gateway"
  ssh-key                  = "technical-account-vault"
  avn-vault-vpc-cidr       = data.terraform_remote_state.vpc.outputs.vpc_cidr_block
  parachain_vpc_cidr_block = data.terraform_remote_state.parachain_dev.outputs.vpc_cidr_block
  vpc-id                   = data.terraform_remote_state.vpc.outputs.vpc_id
  subnet-id                = data.terraform_remote_state.vpc.outputs.primary_private_subnet.id
  availability_zone        = data.terraform_remote_state.vpc.outputs.primary_private_subnet.availability_zone
  aws-route53-zone         = module.dns.public_zone_id
  avn_vault_instance_type  = "t3a.medium"
  tls_cert_subdomain       = "vault"
  dynamodb_table_name      = "avn-gw-vault-${local.environment}-db"
  avn-ingress-ports        = []
  ami_image_id             = "ami-0a8e758f5e873d1c1"
}

module "bastion" {
  source           = "../../../modules/bastion"
  vpc_id           = data.terraform_remote_state.vpc.outputs.vpc_id
  ssh_key_name     = aws_key_pair.vault-ssh-key.key_name
  public_subnet_id = data.terraform_remote_state.vpc.outputs.primary_public_subnet.id
  ssh_allowed_ips  = local.ssh_allowed_ips
  ami_image_id     = "ami-0a8e758f5e873d1c1"
}

resource "local_file" "avn-gateway-vault-instance-file" {
  content  = <<-EOD
[bastion]
${module.bastion.public_ip} ansible_user=ubuntu

[vault_server]
${module.avn-vault.instance_ip_addr} ansible_user=ubuntu

[vault_server:vars]
ansible_ssh_common_args='-o ProxyCommand="ssh -o StrictHostKeyChecking=no -W %h:%p -q ubuntu@${module.bastion.public_ip}"'
api_addr_value='https://${module.avn-vault.fqdn}:8200'
aws_region='${module.avn-vault.aws_region}'
kms_key_id='${module.avn-vault.kms_key_id}'
dynamodb_table='${module.avn-vault.dynamodb_table}'
EOD
  filename = "${path.module}/vault.inventory"
}
