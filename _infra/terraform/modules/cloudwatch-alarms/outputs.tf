output "cloudwatch_metric_alarm_arn" {
  value = tomap({
    for k, v in module.metric_alarm : k => v.cloudwatch_metric_alarm_arn
  })
}

output "cloudwatch_metric_alarm_id" {
  value = tomap({
    for k, v in module.metric_alarm : k => v.cloudwatch_metric_alarm_id
  })
}
