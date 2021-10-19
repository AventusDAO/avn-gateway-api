output "invoke_arns" {
  value = tomap({
    for k, v in aws_lambda_function.lambda : k => v.invoke_arn
  })
}

output "lambda_arns" {
  value = tomap({
    for k, v in aws_lambda_function.lambda : k => v.arn
  })
}