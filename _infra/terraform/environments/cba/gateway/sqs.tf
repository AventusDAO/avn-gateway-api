module "gateway_sqs" {
  source = "../../../modules/sqs"

  queues = {
    gateway_default_queue = {
      fifo_queue                    = true
      message_retention_seconds     = 900
      visibility_timeout_seconds    = 180
      create_dlq                    = true
      dlq_message_retention_seconds = 1209600

    }

    gateway_payer_queue = {
      fifo_queue                    = true
      message_retention_seconds     = 900
      visibility_timeout_seconds    = 180
      create_dlq                    = true
      dlq_message_retention_seconds = 1209600
    }
  }
}
