module "sqs" {
  source  = "terraform-aws-modules/sqs/aws"
  version = "4.0.0"

  name                          = each.key
  fifo_queue                    = lookup(each.value, "fifo_queue", var.queues)
  tags                          = local.all_resources_tags
  message_retention_seconds     = lookup(each.value, "message_retention_seconds", var.queues)
  visibility_timeout_seconds    = lookup(each.value, "visibility_timeout_seconds", var.queues)
  create_dlq                    = lookup(each.value, "create_dlq", var.queues)
  dlq_message_retention_seconds = lookup(each.value, "dlq_message_retention_seconds", var.queues)

  for_each = var.queues
}
