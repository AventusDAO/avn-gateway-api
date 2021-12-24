## AvN-Gateway setup
The setup of the avn-gateway (and its layers and lambdas) is handled by Serverless and defined in the `serverless.yml` file
For available properties see: https://www.serverless.com/framework/docs/providers/aws/guide/serverless.yml
Layers are resources that can be shared across lambdas and are contained in folders (eg: `common/`)
Lambdas are individual route handler functions and contained in individual .js files (eg: `poll-handler.js`)

### Prerequisites
Install Serverless:
```
npm install -g serverless
```
You may need to add your AWS credentials:
https://www.serverless.com/framework/docs/providers/aws/guide/credentials


### Deploying the avn-gateway
Ensure the node modules in any layer folders are up-to-date, then:
```
serverless deploy --env stargate
```

### Removing the avn-gateway
```
serverless remove --env stargate
```

### Deploying a single lambda (fast)
```
serverless deploy function --function query-handler --env stargate
```