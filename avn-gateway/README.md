## Overview
The gateway setup is handled by Serverless and defined in `serverless.yml`
For available serverless properties see: https://www.serverless.com/framework/docs/providers/aws/guide/serverless.yml
Individual stage variables can be set in `stages.js` which get dynamically referenced in `serverless.yml`
Layers are common lambda resources and are contained in folders (eg: `common/`)
Lambdas are individual authorisation and route handler functions and are contained in `*-handler.js` files (eg: `poll-handler.js`)


## Prerequisites
Install serverless and other packages:
```
npm i
```
Set up the AWS credentials: https://www.serverless.com/framework/docs/providers/aws/guide/credentials
To view the credentials by stage: https://aventus-network-services.awsapps.com/start#/


## Development
Ensure the node modules in any layer folders are up-to-date.
Ensure you've set up and are pointing to the AWS credentials for the stage.

### Deploy all lambdas and/or layer changes
```
sls deploy --stage sandbox
```

### Remove all lambdas and layers
```
sls remove --stage sandbox
```

### Update a single lambda (fast)
```
sls deploy function --function query-handler --stage sandbox
```