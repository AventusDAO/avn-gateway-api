## Kubernetes cluster resources

- [AWS load balanacer controller](./aws-lb-controller/): Controls the creation of AWS loadbalancers that route traffic into our cluster.
- [External dns controller](./external-dns/): Controls route53 records for internal resources.
- [External secrets manager](./external-secrets-manager/): Allows seamless migration of AWS Secrets manager secrets to kubernetes secrets.
- [Fluent bit](./fluent-bit/): Output logs to Cloudwatch.
- [NginX](./nginx/): Controls ingress traffic.
- [RabbitMQ](./rabbit/): Deploys Rabbitmq for developer environments only.