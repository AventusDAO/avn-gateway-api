resource "aws_apigatewayv2_api" "avn_gateway_api" {
  name          = "avn-gateway-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "poll" {
  api_id           = aws_apigatewayv2_api.avn_gateway_api.id
  integration_type = "AWS_PROXY"

  connection_type        = "INTERNET"
  description            = "Poll handler integration"
  integration_method     = "POST"
  integration_uri        = var.poll_invoke_arn
  passthrough_behavior   = "WHEN_NO_MATCH"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "poll" {
  api_id    = aws_apigatewayv2_api.avn_gateway_api.id
  route_key = "POST /poll"

  target             = "integrations/${aws_apigatewayv2_integration.poll.id}"
  authorizer_id      = aws_apigatewayv2_authorizer.authoriser.id
  authorization_type = "CUSTOM"
}

resource "aws_apigatewayv2_integration" "send" {
  api_id           = aws_apigatewayv2_api.avn_gateway_api.id
  integration_type = "AWS_PROXY"

  connection_type        = "INTERNET"
  description            = "Send handler integration"
  integration_method     = "POST"
  integration_uri        = var.send_invoke_arn
  passthrough_behavior   = "WHEN_NO_MATCH"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "send" {
  api_id    = aws_apigatewayv2_api.avn_gateway_api.id
  route_key = "POST /send"

  target             = "integrations/${aws_apigatewayv2_integration.send.id}"
  authorizer_id      = aws_apigatewayv2_authorizer.authoriser.id
  authorization_type = "CUSTOM"
}

resource "aws_apigatewayv2_integration" "query" {
  api_id           = aws_apigatewayv2_api.avn_gateway_api.id
  integration_type = "AWS_PROXY"

  connection_type        = "INTERNET"
  description            = "Query handler integration"
  integration_method     = "POST"
  integration_uri        = var.query_invoke_arn
  passthrough_behavior   = "WHEN_NO_MATCH"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "query" {
  api_id    = aws_apigatewayv2_api.avn_gateway_api.id
  route_key = "POST /query"

  target             = "integrations/${aws_apigatewayv2_integration.query.id}"
  authorizer_id      = aws_apigatewayv2_authorizer.authoriser.id
  authorization_type = "CUSTOM"
}

resource "aws_apigatewayv2_authorizer" "authoriser" {
  name                    = "authorisation-handler"
  api_id                  = aws_apigatewayv2_api.avn_gateway_api.id
  authorizer_type         = "REQUEST"
  authorizer_uri          = var.authoriser_invoke_arn
  enable_simple_responses = true
  identity_sources        = ["$request.header.Authorization"]
 
  authorizer_payload_format_version = "2.0"
}

resource "aws_apigatewayv2_deployment" "default" {
  api_id      = aws_apigatewayv2_api.avn_gateway_api.id
  description = "avn-gateway-api deployment"

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_apigatewayv2_route.poll,
    aws_apigatewayv2_route.query,
    aws_apigatewayv2_route.send
  ]
}

resource "aws_apigatewayv2_stage" "default" {
  api_id = aws_apigatewayv2_api.avn_gateway_api.id
  name   = "$default"

  auto_deploy = true
}