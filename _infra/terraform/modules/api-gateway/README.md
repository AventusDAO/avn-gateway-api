## api-gateway
Module for the Amazon api gateway entry points to the gateway api service.

## Variables

| name | required | default | description |
|------|----------|---------|-------------|
| query\_handler\_arn | true | | The ARN of the query handler Lambda function |
| authorisation\_handler\_arn | true | | The ARN of the authorisation handler Lambda function |
| poll\_handler\_arn | true | | The ARN of the poll handler Lambda function |
| send\_handler\_arn | true | | The ARN of the send handler Lambda function |