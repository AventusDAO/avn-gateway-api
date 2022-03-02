## External Secrets manager
The external secrets manager integrated with AWS Secrets manager. It provides a CRD (custom resource definition) that allows a secret to be pulled down from AWS Secrets manager to a kubernetes secret, an example of how this is done is as follows:

```
apiVersion: "kubernetes-client.io/v1"
kind: ExternalSecret
metadata:
  name: mongo-credentials # Name of the externalsecret and the resulting kubernetes secret
spec:
  backendType: secretsManager #AWS Secrets manager, but also supports parameter store
  data:
    - key: documentdb     # The AWS Secret name
      name: password      # The key name within the mongo-credentials kubernetes secret
      property: password  # The property name within the AWS secret
```

This manifest will search for the AWS Secret `documentdb` and create a Kubernetes secret called `mongo-credentials` that will contain a key `password` with the secret from the json property `password`.

The External secret manager is granted specific permissions that are accessed via a kubernetes service account, the terraform code is [here](https://github.com/Aventus-Network-Services/avn-gateway-api/blob/main/_infra/terraform/modules/k8s-service-account-permissions/external-secrets-manager.tf). It behaves similar to the aws-load balancer, consult the aws lb controller [readme](../aws-lb-controller/) for more information on how an IAM role is assumed with a kubernetes service account.