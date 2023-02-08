module "gateway_sqs" {
  source = "../../../modules/sqs"

  queues = {
    gateway_default_queue = {
      fifo_queue                = true
      message_retention_seconds = 1209600
    }

    gateway_payer_queue = {
      fifo_queue                = true
      message_retention_seconds = 1209600
    }
  }
}