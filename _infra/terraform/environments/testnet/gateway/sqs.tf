module "gateway_sqs" {
  source = "../../../modules/sqs"

  queues = {
    gateway_default_queue = {
      fifo_queue                    = true
      message_retention_seconds     = 86400
      visibility_timeout_seconds    = 60
      create_dlq                    = true
      dlq_message_retention_seconds = 1209600
      receive_wait_time_seconds     = 10
      max_receive_count             = 3
    }

    gateway_payer_queue = {
      fifo_queue                    = true
      message_retention_seconds     = 86400
      visibility_timeout_seconds    = 60
      create_dlq                    = true
      dlq_message_retention_seconds = 1209600
      receive_wait_time_seconds     = 10
      max_receive_count             = 3      
    }
  }
}
