module "sqs" {
  source  = "terraform-aws-modules/sqs/aws"
  version = "4.0.0"

  name                      = each.key
  fifo_queue                = lookup(each.value, "fifo_queue", var.queues)
  tags                      = local.all_resources_tags
  message_retention_seconds = lookup(each.value, "message_retention_seconds", var.queues)

  for_each = var.queues
}
