// for now, the email used to send the temp password to users will be no-reply@verificationemail.com
// This is limited to 50emails/day and aws recomend to use AMAZON SES
resource "aws_cognito_user_pool" "this" {
  name = "admin-split-fee"

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  admin_create_user_config {
    allow_admin_create_user_only = true

    invite_message_template {
      email_message = <<EOT
    <h3>Welcome to the AvN Gateway</h3>
    <p>You have successfully registered as a payer on the avn gateway.</p>
    Your username is <b>{username}</b> and temporary password is <b>{####}</b>
    <p>You will be prompted to change your password when you first log in, this password will expire in 1 day.</p>
EOT
      email_subject = "AvN Gateway registration - your temporary password"
      sms_message   = "Your username is {username} and temporary password is {####}."
    }
  }

  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    require_uppercase                = true
    temporary_password_validity_days = 1
  }

  software_token_mfa_configuration {
    enabled = false
  }

  user_pool_add_ons {
    advanced_security_mode = var.user_pool_advanced_security_mode
  }

  device_configuration {
    challenge_required_on_new_device      = true
    device_only_remembered_on_user_prompt = true
  }

  deletion_protection = "ACTIVE"
  mfa_configuration   = "ON"
  username_attributes = ["email"]

  tags = local.all_resources_tags
}

resource "aws_cognito_user_pool_domain" "this" {
  domain          = var.domain
  certificate_arn = var.domain_certificate_arn
  user_pool_id    = aws_cognito_user_pool.this.id
}

resource "aws_cognito_user_pool_client" "this" {
  name                                 = "admin-split-fee"
  user_pool_id                         = aws_cognito_user_pool.this.id
  generate_secret                      = true
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  explicit_auth_flows                  = ["USER_PASSWORD_AUTH"]
  allowed_oauth_scopes                 = ["email", "openid"]
  callback_urls                        = var.callback_urls
  logout_urls                          = var.logout_urls
  prevent_user_existence_errors        = "ENABLED"
  supported_identity_providers         = ["COGNITO"]
}

resource "aws_route53_record" "this" {
  name            = aws_cognito_user_pool_domain.this.domain
  zone_id         = data.aws_route53_zone.domain.zone_id
  type            = "A"
  allow_overwrite = true

  alias {
    name                   = aws_cognito_user_pool_domain.this.cloudfront_distribution_arn
    evaluate_target_health = false
    # This zone_id is fixed
    zone_id = "Z2FDTNDATAQYW2"
  }
}

resource "aws_secretsmanager_secret" "this" {
  name                    = "cognito_gateway_admin_details"
  recovery_window_in_days = 0
}
