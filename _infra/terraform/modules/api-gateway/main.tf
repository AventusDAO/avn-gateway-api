resource "aws_apigatewayv2_api" "avn_gateway_api" {
  name          = "avn-gateway-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "poll" {
  for_each = var.skeleton_gateway ? toset([]) : toset(["full"])

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
  for_each = var.skeleton_gateway ? toset([]) : toset(["full"])

  api_id    = aws_apigatewayv2_api.avn_gateway_api.id
  route_key = "POST /poll"

  target             = "integrations/${aws_apigatewayv2_integration.poll["full"].id}"
  authorizer_id      = aws_apigatewayv2_authorizer.authoriser["full"].id
  authorization_type = "CUSTOM"

  depends_on = [
    aws_apigatewayv2_route.query
  ]
}

resource "aws_apigatewayv2_integration" "send" {
  for_each = var.skeleton_gateway ? toset([]) : toset(["full"])

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
  for_each = var.skeleton_gateway ? toset([]) : toset(["full"])

  api_id    = aws_apigatewayv2_api.avn_gateway_api.id
  route_key = "POST /send"

  target             = "integrations/${aws_apigatewayv2_integration.send["full"].id}"
  authorizer_id      = aws_apigatewayv2_authorizer.authoriser["full"].id
  authorization_type = "CUSTOM"
}

resource "aws_apigatewayv2_integration" "query" {
  for_each = var.skeleton_gateway ? toset([]) : toset(["full"])

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
  for_each = var.skeleton_gateway ? toset([]) : toset(["full"])

  api_id    = aws_apigatewayv2_api.avn_gateway_api.id
  route_key = "POST /query"

  target             = "integrations/${aws_apigatewayv2_integration.query["full"].id}"
  authorizer_id      = aws_apigatewayv2_authorizer.authoriser["full"].id
  authorization_type = "CUSTOM"

  depends_on = [
    aws_apigatewayv2_integration.send
  ]
}

resource "aws_apigatewayv2_authorizer" "authoriser" {
  for_each = var.skeleton_gateway ? toset([]) : toset(["full"])

  name                    = "authorisation-handler"
  api_id                  = aws_apigatewayv2_api.avn_gateway_api.id
  authorizer_type         = "REQUEST"
  authorizer_uri          = var.authoriser_invoke_arn
  enable_simple_responses = true
  identity_sources        = ["$request.header.Authorization"]
  
  authorizer_result_ttl_in_seconds  = var.auth_cache_duration
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

resource "aws_cloudwatch_log_group" "gateway" {
  name              = "/aws/lambda/avn-gateway-api"
  retention_in_days = var.log_retention_period
}

resource "aws_apigatewayv2_stage" "default" {
  api_id = aws_apigatewayv2_api.avn_gateway_api.id
  name   = "$default"

  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.gateway.arn
    format          = jsonencode({
      httpMethod     = "$context.httpMethod"
      ip             = "$context.identity.sourceIp"
      protocol       = "$context.protocol"
      requestId      = "$context.requestId"
      requestTime    = "$context.requestTime"
      responseLength = "$context.responseLength"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
    })
  }

  depends_on = [
    aws_cloudwatch_log_group.gateway
  ]
}

resource "aws_iam_role" "invocation_role" {
  name = "api_gateway_auth_invocation"
  path = "/"

  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": "apigateway.amazonaws.com"
      },
      "Effect": "Allow",
      "Sid": ""
    }
  ]
}
EOF
}

resource "aws_iam_role_policy" "invocation_policy" {
  for_each = var.skeleton_gateway ? [] : ["full"]

  name = "AuthoriserInvokeArn"
  role = aws_iam_role.invocation_role.id

  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "lambda:InvokeFunction",
      "Effect": "Allow",
      "Resource": "${var.authoriser_invoke_arn}"
    }
  ]
}
EOF
}