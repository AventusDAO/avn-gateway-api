## Overview
The gateway setup is handled by Serverless and defined in `serverless.yml`
For available serverless properties see: https://www.serverless.com/framework/docs/providers/aws/guide/serverless.yml
Configs can be set in `config.js`
Layers are common lambda resources and are contained in folders (eg: `common/`)
Lambdas are individual authorisation and route handler functions and are contained in `*-handler.js` files (eg: `poll-handler.js`)


## Prerequisites
Install serverless and other packages:
```
npm i
```
Set up the AWS credentials: https://www.serverless.com/framework/docs/providers/aws/guide/credentials
To view the credentials by config: https://aventus-network-services.awsapps.com/start#/


## Development
Ensure the node modules in any layer folders are up-to-date.
Ensure you've set up and are pointing to the AWS credentials for the particular config.

### Deploy all lambdas and/or layer changes
```
sls deploy --config sandbox
```

### Remove all lambdas and layers
```
sls remove --config sandbox
```

### Update a single lambda (fast)
```
sls deploy function --function query-handler --config sandbox
```