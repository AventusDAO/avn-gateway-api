module "gateway_sqs" {
  source = "../../../modules/sqs"

  queues = {
    gateway_default_queue = {
      fifo_queue = true
    }

    gateway_payer_queue = {
      fifo_queue = true
    }
  }
}
