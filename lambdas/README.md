## Create a new lambda function
1. Create YOUR_LAMBDA as a basic lambda function via the AWS console.
2. Attach to an API Gateway route as required.
3. Add a new folder in the lambdas directory titled YOUR_LAMBDA and include:
    * index.js
    * package.json
    * any additional files your lambda requires
4. Install any node modules required by your lambda in YOUR_LAMBDA's directory.
5. Include YOUR_LAMBDA in the LAMBDA array in update.js.

## Update the code on AWS
From the lambdas root directory run `node update.js YOUR_LAMBDA` or `node update.js all` to update all lambdas.

### Testing
For local testing, uncomment the testlocal() function at the bottom of the lambda's index.js.

