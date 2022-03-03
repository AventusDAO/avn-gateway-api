## FluentBit
Streams logs, outputted by pods, to Cloudwatch. The grok filters are defined in the [values.yaml](./values.yaml). They allow the logs to be converted into json and indexed in Cloudwatch.

FluentBit must have permission to write to Cloudwatch, the iam permissions are defined [here](https://github.com/Aventus-Network-Services/avn-gateway-api/blob/main/_infra/terraform/modules/k8s-service-account-permissions/fluent-bit.tf). Similar to the load balancer controller - we create a Kubernetes Service Account that is directly linked to an IAM role. The controller assumes this role via the kubernetes service account granting it all the necessary permissions.
