## api-gateway
Module for the Amazon api gateway entry points to the gateway api service.

## Variables

| name | required | default | description |
|------|----------|---------|-------------|
| query\_invoke\_arn | true | | The invoke ARN of the query handler Lambda function |
| authoriser\_invoke\_arn | true | | The invoke ARN of the authorisation handler Lambda function |
| poll\_invoke\_arn | true | | The invoke ARN of the poll handler Lambda function |
| send\_invoke\_arn | true | | The invoke ARN of the send handler Lambda function |