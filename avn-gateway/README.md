## Overview
The setup of the authorisation, layers, lambdas and routes of a gateway is handled by Serverless and defined in `serverless.yml`.

For serverless properties see: https://www.serverless.com/framework/docs/providers/aws/guide/serverless.yml

Each environment has its own variables which can be set in the other `*.yml` files (eg: `sandbox.yml`)

Layers (code shared between lambdas) are contained in folders (eg: `common/`)

Lambdas are contained in `*-handler.js` files (eg: `poll-handler.js`)


## Prerequisites
Install serverless: `npm install -g serverless`

Set up AWS credentials if required: https://www.serverless.com/framework/docs/providers/aws/guide/credentials

**NOTE**: make sure you install the packages from `common` and `queue` on your local machine before deploying using serverless. Please run `npm ci --production` inside each folder.

## Development
1) Ensure the node modules in any layer folders (eg: `common/` or `queue/`) are up-to-date by running `npm i` in them.

2) Set the environment variable `SLS_ENV` to point to the environment you'll be deploying to (eg: `export SLS_ENV=sandbox`)

3) Ensure you've set the correct AWS environment variables for your environment in your terminal by copying them from here:
https://aventus-network-services.awsapps.com/start#/
(eg: `AWS Account > AVN Sandbox > AdministratorAccess > Command line or programmatic access > Option 1 - "Click to copy these commands"`)

4) Push your changes to AWS:

##### Update/deploy all lambdas and layers (slow but required for changes to layers or adding new lambdas etc)
```
sls deploy
```
##### Update/add a single lambda (fast)
```
sls deploy function --function query-handler
```
##### Remove all lambdas and layers
```
sls remove
```
