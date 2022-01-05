## Overview
The setup of the auth, layers, lambdas and routes of a gateway is handled by Serverless and defined in `serverless.yml`
(for serverless properties see: https://www.serverless.com/framework/docs/providers/aws/guide/serverless.yml)
Each environment has its own variables which can be set in the other `*.yml` files (eg: `sandbox.yml`)
Layers are contained in folders (eg: `common/`)
Lambdas are contained in `*-handler.js` files (eg: `poll-handler.js`)

## Prerequisites
Install dependencies: `npm i`
Set up AWS if required: https://www.serverless.com/framework/docs/providers/aws/guide/credentials

## Development
Ensure the node modules in any layer folders are up-to-date.
Set the environment, (eg: `export SLS_ENV=sandbox`)
Ensure you've set the correct AWS credentials for the environment (see: https://aventus-network-services.awsapps.com/start#/)

### Update/deploy all lambdas and layers
```
sls deploy
```
### Update/add a single lambda (fast)
```
sls deploy function --function query-handler
```
### Remove all lambdas and layers
```
sls remove
```
