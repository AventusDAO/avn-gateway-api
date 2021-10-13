## lambda
Amazon AWS Lambda services which comprise the following:
- poll handler
- query handler
- send handler
- authorisation handler

## Inputs

| name | required | default | description |
|------|----------|---------|-------------|
| service_version | false | `latest` | The version of our lambdas |
| region | false | `eu-west-1` | AWS region |
| lambda\_names | false | `poll-handler`,`query-handler`, `send-handler`, `authoriser-handler` | Lambda function names relates directly to defined [lambdas](../../../../../lambdas) |
| log\_retention\_period | false | `90` | retention period for cloudwatch logs on lambda functions can be 1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653, and 0. If you select 0, the events in the log group never expire. |
| lambda\_runtime | false | `nodejs14.x` | AWS lambda runtime |
| artifact\_bucket | true | | Bucket that sotres the lambda zips |

## Outputs

| name | description |
|------|-------------|
| invoke\_arns | Map of invoke arns, where the key is lambda function name and value is the invoke arn |
