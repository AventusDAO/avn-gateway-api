## Pipelines
Currently there are 3 pipelines for the avn-gateway:

- [infrastructure](#infrastructure-deployment)
- [vault](#vault-deployment)
- [avn-connector](#avn-connector-deployment)

## Deploying a new environment
Follow these steps to deploy a new environment. If you are deploying into a new AWS account then start from step 1. If recreating an environment that has been previously created/destroyed then start from step 15:

  1. Ensure that the `jenkins-access` policy has the following permissions as a minimum:
  ```
  {
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": [
                "logs:*",
                "elasticloadbalancing:*",
                "route53:*",
                "route53domains:*",
                "cloudtrail:*",
                "ec2:*",
                "route53resolver:*",
                "cloudwatch:*",
                "kms:*",
                "iam:*",
                "s3:*",
                "es:*",
                "sns:*",
                "lambda:*",
                "elasticfilesystem:*",
                "rds:*",
                "secretsmanager:*",
                "sqs:*",
                "memorydb:*",
                "lambda:*",
                "apigateway:*",
                "acm:*",
                "eks:*",
                "dynamodb:*",
                "mq:*",
                "autoscaling:*"
            ],
            "Resource": "*"
        }
    ]
  }
  ```
  2. Make sure that none of the `jenkins-access` role policies deny `acm:*`
  3. A new AWS account will need a vault certificate and key, run the following command that uses cert-bot in a clean folder (many sub folders will be created from this command, enough to confuse you if you aren't in a clean directory)
  **MAKE SURE TO CHANGE "\<environment\>" TO THE CORRECT ENVIRONMENT NAME**:
  ```
  certbot certonly --manual -d "vault.\<envrionment\>.gateway.aventus.io" --agree-tos --manual-public-ip-logging-ok --preferred-challenges dns-01 --register-unsafely-without-email --rsa-key-size 4096 --config-dir=./ --work-dir=./ --logs-dir=./
  ```
  Keep the output on the screen and **DO NOT** press enter yet.
  
  4. you will be prompted to insert a TXT record into the aventus managed zone in the aventus main account. Navigate to the aventus main account `707061609910`, If you have no access then an SSO admin can provide that to you.
  5. Within the aventus main account, navigate to route53 and to the `aventus.io` DNS management hosted zone.
  6. Click the `create record` button and paste in the cert-bot _acme_challenge address from step 3 into the `record name` field. Select `TXT` as the `record type` and paste in the txt field from step 3 into the `value` field. click the create records button
  7. A blue banner should appear at the top of the screen where you can view the progress of the record. click it ans wait for it to go from `PENDING` to `IN_SYNC`
  8. Back to your terminal with cert-bot output. Press enter. your cert key and chain will be created.
  9. navigate to the `./archive/vault...` directory just created and copy your `fullchain1.pem` to the [ansible files directory](./ansible/files/vault-server/files) as `vault_envname.crt`. Add this to a git PR
  10. modify the [jenkinsfile.vault](./Jenkinsfile.vault) file to use a new credential similar to [here](https://github.com/Aventus-Network-Services/avn-gateway-api/blob/0628376ab895060bd3d5dfec5716a039ab8684c9/_infra/Jenkinsfile.vault#L57). also add to the switch case below it.
  11. Add your new environment to the each of the Jenkinsfile `environment` parameters in this directory.
  12. raise a PR and merge
  13. Merging this is not enough, Jenkins has no visibility of the new Jenkinsfile until your run the pipeline, so run the infrastructure and vault pipeline in sandbox. And cancel after if has finished checking out the code (this is a severe and rather annoying Jenkins limitation)
  14. Navigate to Jenkins `manage credentials` and create a new creadential called `vault_tls_key_envname`, changing envname to your environment name. the type is `secret file`. Upload your `privkey1.pem` supplied by cert-bot in step 9
  15. Run the [infrastructure deployment pipeline](#infrastructure-deployment) selecting your environment, terraform_target = `all`, apply_third_party_charts=`true`, new_environment=`true`. You will be prompted twice by the pipeline to proceed with the deployment as terraform plans are generated.
  16. You must ensure that the NAT gateway created by the pipeline is whitelisted to the blockchain you are connecting to, you will have to get the nat ip and add it to the trusted security group for that block chain.
  17. Create a relayer account in the blockchain, fund it and add it to vault.

## Infrastructure deployment
The infrastructure can be deployed to a new/current environment following this process:

Go to the avn-gateway-sandbox-infrastructure job [here](https://jenkins.test.aventus.io/view/Sandbox/job/avn-gateway-sandbox-infrastructure/). You will see a list of branches, if your branch isnt there then click on `Scan multibranch pipeline now` and it should appear.

The pipeline is capable of building the entire infrastructure and deploying all relevant resources, if you click on a specific branch (usually `main`) then you can build the project by clicking `build with parameters`. This example is for the branch `SYS-1479-create-jenkinsfile`:
![The infrastructure pipeline](./infrastructure.png)
  1. `terraform_target`: This can target a specific terraform module. The option of `all` and `none` will run the entire terraform script or ignore it completely.
  2. `additional_terraform_args`: Supply additional terraform commandline arguments, Eg. `-destroy` will run a destroy plan. If the infrastructure is being destroyed then subsequent kubernetes steps will be ignored.
  3. `apply_third_party_charts`: `true` if you want to deploy the third party helm charts to kubernetes, The Third party charts include the aws-loadbalancer-controller, cert-manager, external-secrets-manager etc.
  4. `new_environment`: `true` if you want to create a new environment. The only difference is that this step will launch the terraform plan/apply for the `vpc` module before running a plan/apply on the rest of the infrastructure. Running the VPC module before everything else is required for a new environment. You can set this to `true` for a current environment nothing will be destroyed (The redis creation step will fail on subsequent runs but thats ok, its safe to set this to `true` for any environment at any time).

The pipeline will run a terraform plan and will wait for user input to proceed. Be sure to check that the terraform plan is OK before proceeding - if it is not then you can click abort which will abort the pipeline.
![Wait for user input](./pipeline-wait.png)

## Vault deployment
This pipeline is run as part of new environment setup in the [infrastructure pipeline](#infrastructure-deployment). It configures the Vault EC2 instance and ensures that it is ready to accept a new relayer account.

## avn-connector deployment
This pipeline deploys the avn-connector to kubernetes and runs smoke tests. you can supply a docker tag aswell as a target environment.