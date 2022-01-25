
output "public_ip" {
  value = aws_instance.avn-gw-bastion.public_ip
}


output "private_cidr" {
  value = "${aws_instance.avn-gw-bastion.private_ip}/32"
}