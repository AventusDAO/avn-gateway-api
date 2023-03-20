data "aws_sns_topic" "notify_slack" {
  name = "notify-slack-topic"
}

data "aws_sqs_queue" "gateway_default_queue" {
  name = "gateway_default_queue-dlq.fifo"
}

data "aws_sqs_queue" "gateway_payer_queue" {
  name = "gateway_payer_queue-dlq.fifo"
}

module "gateway_alarms" {
  source = "../../../modules/cloudwatch-alarms"

  alarms = {
    gateway-default-queue-dlq-alarm = {
      alarm_description             = "Warning: DLQ queue [${data.aws_sqs_queue.gateway_default_queue.name}] has more than 20 messages in the queue. Please investigate and take appropriate actions to avoid service disruption."
      comparison_operator           = "GreaterThanOrEqualToThreshold"
      evaluation_periods            = 1
      threshold                     = 20
      period                        = 300
      unit                          = "Count"
      namespace                     = "AWS/SQS"
      metric_name                   = "NumberOfMessagesSent"
      statistic                     = "Sum"
      alarm_actions                 = data.aws_sns_topic.notify_slack.arn
      dimensions = {
        QueueName = data.aws_sqs_queue.gateway_default_queue.name
      }
    }

    gateway-payer-queue-dlq-alarm = {
      alarm_description             = "Warning: DLQ queue [${data.aws_sqs_queue.gateway_payer_queue.name}] has more than 20 messages in the queue. Please investigate and take appropriate actions to avoid service disruption."      
      comparison_operator           = "GreaterThanOrEqualToThreshold"
      evaluation_periods            = 1
      threshold                     = 20
      period                        = 300
      unit                          = "Count"
      namespace                     = "AWS/SQS"
      metric_name                   = "NumberOfMessagesSent"
      statistic                     = "Sum"
      alarm_actions                 = data.aws_sns_topic.notify_slack.arn
      dimensions = {
        QueueName = data.aws_sqs_queue.gateway_payer_queue.name
      }
    }
  }
}
