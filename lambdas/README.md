## Create a new lambda function
1. Create YOUR_LAMBDA as a basic lambda function via the AWS console.
2. Attach to an API Gateway route as required.
3. Add a new folder in the lambdas directory titled YOUR_LAMBDA and include:
    * index.js
    * package.json
    * any additional files your function requires
4. Install any node modules required by your lambda in YOUR_LAMBDA's directory as these need to be uploaded on deployment.
5. Include YOUR_LAMBDA in the update.js LAMBDA array;

## Update the code on AWS
Run 'node update.js YOUR_LAMBDA' or 'node update.js all' from the lambdas root directory.

### Testing
For local testing, uncomment the testlocal function at the bottom of the lambda's index.js.