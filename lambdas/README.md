## Create or update a lambda layer
A lambda layer is a collection of files or modules that can be referenced cross multiple lambda functions.
The source code of a lambda layer can be published to AWS in the same way as for a lambda function.
They are located within the `./lambdas/layer/nodejs/` directory. Once they are published to AWS and added to lambda function, these files are decompressed to a `/opt/nodejs/` folder.

In order to create or update a lambda layer, from the lambdas root directory:
```
$node ./update.js layer
```

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
From the lambdas root directory run 
```
node update.js lambda YOUR_LAMBDA
```
or
```
node update.js lambda all #update all lambdas
```

### Local Testing
From the lambdas root directory run 
1. Replace `/opt/nodejs/` with `../layer/nodejs` in all files if there are any and install npm modules by running
   ```
   node update.js local YOUR_LAMBDA
   ```
2. Uncomment the testlocal() function at the bottom of the lambda's index.js.
3. Execute testlocal() function as
   ```
   MQ_AVN_TX_QUEUE=avnTx MQ_BROKER_AMQP_ENDPOINT=amqps://x-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.mq.{aws_region}.amazonaws.com:5671 MQ_SECRET_ARN=arn:aws:secretsmanager:{aws_region}:0123456789:secret:{ABCDEFG-012Abc} SECRET_MANAGER_REGION=eu-west-1 node index.js
   ```

