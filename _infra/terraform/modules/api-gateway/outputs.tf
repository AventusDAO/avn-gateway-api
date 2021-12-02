output "url" {
  value = trimprefix(aws_apigatewayv2_api.avn_gateway_api.api_endpoint, "https://")
}

output "api_id" {
  value = aws_apigatewayv2_api.avn_gateway_api.id
}

output "stage_id" {
  value = aws_apigatewayv2_stage.default.id
}