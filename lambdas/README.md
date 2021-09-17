# Creating new lambda functions

### Create a new lambda function
1. Create YOUR_LAMBDA as a basic lambda function via the AWS console.
2. Attach to an API Gateway route as required.
3. Add a new folder in the lambdas directory titled YOUR_LAMBDA and include:
    * index.js
    * package.json
    * any additional files your function requires
4. Run `npm install` in YOUR_LAMBDA folder to generate node_modules folder.
5. Zip the entire contents of YOUR_LAMBDA folder into YOUR_LAMBDA.zip.
6. From the folder run `aws lambda update-function-code --function-name YOUR_LAMBDA --zip-file fileb://YOUR_LAMBDA.zip` to upload the function to AWS.

### Testing
For local testing, comment out the `exports.handler` function and replace with a local test function (see `example/index.js`)