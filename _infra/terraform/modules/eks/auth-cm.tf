# data "http" "wait_for_cluster" {
#   url            = format("%s/healthz", aws_eks_cluster.this.endpoint)
#   # ca_certificate = base64decode(aws_eks_cluster.this.certificate_authority[0].data)
#   # timeout        = 300

#   depends_on = [
#     aws_eks_cluster.this
#   ]
# }

data "aws_eks_cluster_auth" "this" {
  name = var.cluster_name
}

provider "kubernetes" {  
  host = aws_eks_cluster.this.endpoint
  
  cluster_ca_certificate = base64decode(aws_eks_cluster.this.certificate_authority[0].data)
  token                  = data.aws_eks_cluster_auth.this.token
}

locals {
  configmap_roles = [
    {
      rolearn  = aws_iam_role.node_group.arn
      username = "system:node:{{EC2PrivateDNSName}}"
      groups = tolist(concat(
        [
          "system:bootstrappers",
          "system:nodes",
        ]
      ))
    }
  ]
}

resource "kubernetes_config_map" "aws_auth" {
  metadata {
    name      = "aws-auth"
    namespace = "kube-system"
    labels = merge(
      {
        "app.kubernetes.io/managed-by" = "Terraform"
      }
    )
  }

  data = {
    mapRoles = yamlencode(
        local.configmap_roles
      )
    # mapUsers    = yamlencode(var.map_users)
  }

  # depends_on = [data.http.wait_for_cluster]
}
