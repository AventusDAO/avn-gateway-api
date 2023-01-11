output "queue_arn" {
  value = tomap({
    for k, v in module.sqs : k => v.queue_arn
  })
}

output "queue_name" {
  value = tomap({
    for k, v in module.sqs : k => v.queue_name
  })
}

output "queue_url" {
  value = tomap({
    for k, v in module.sqs : k => v.queue_url
  })
}
