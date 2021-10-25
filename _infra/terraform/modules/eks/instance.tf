data "cloudinit_config" "workers_userdata" {
  gzip          = false
  base64_encode = true
  boundary      = "//"

  part {
    content_type = "text/x-shellscript"
    content = templatefile("${path.module}/template/bootstrap.sh.tpl",
      {
        cluster_name     = var.cluster_name
        cluster_endpoint = aws_eks_cluster.this.endpoint
        cluster_auth_b64 = aws_eks_cluster.this.certificate_authority[0].data
      }
    )
  }
}

resource "aws_launch_template" "workers" {
  name                   = "eks-node-launch-template"
  description            = "EKS Managed Node Group"
  update_default_version = true

  block_device_mappings {
    device_name = "/dev/xvda"

    ebs {
      volume_size           = 20
      delete_on_termination = true
    }
  }

  instance_type = var.template_instance_type

  monitoring {
    enabled = true
  }

  network_interfaces {
    associate_public_ip_address = false
    delete_on_termination       = true
  }

  user_data = data.cloudinit_config.workers_userdata.rendered

  tag_specifications {
    resource_type = "instance"

    tags = {
      "Name": "gateway-api-eks-node"
      "kubernetes.io/cluster/${var.cluster_name}": "owned"
    }
  }

  # Tag the LT itself
  tags = {
    "Name":  "gateway-api-node-template"
  }

  lifecycle {
    create_before_destroy = true
  }
}