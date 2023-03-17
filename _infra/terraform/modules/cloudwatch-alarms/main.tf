module "metric_alarm" {
  source  = "terraform-aws-modules/cloudwatch/aws//modules/metric-alarm"
  version = "4.2.1"

  for_each = var.alarms  

  alarm_name          = each.key
  alarm_description   = lookup(each.value, "alarm_description", var.alarms)
  comparison_operator = lookup(each.value, "comparison_operator", var.alarms)
  evaluation_periods  = lookup(each.value, "evaluation_periods", var.alarms)
  threshold           = lookup(each.value, "threshold", var.alarms)
  period              = lookup(each.value, "period", var.alarms)
  unit                = lookup(each.value, "unit", var.alarms)

  namespace   = lookup(each.value, "namespace", var.alarms)
  metric_name = lookup(each.value, "metric_name", var.alarms)
  statistic   = lookup(each.value, "statistic", var.alarms)

  dimensions = lookup(each.value, "dimensions", var.alarms)

  alarm_actions = [lookup(each.value, "alarm_actions", var.alarms)]
}