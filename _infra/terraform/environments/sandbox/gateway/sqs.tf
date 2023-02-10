module "gateway_sqs" {
  source = "../../../modules/sqs"

  queues = {
    gateway_default_queue = {
      fifo_queue                = true
      message_retention_seconds = 36000
    }

    gateway_payer_queue = {
      fifo_queue                = true
      message_retention_seconds = 36000
    }
  }
}