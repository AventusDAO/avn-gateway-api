# avn-gateway-api - Server code

## Pre-requisite
Before running the container, create a `log` folder with the correct permission by running the following commands from the root of the application:

```
mkdir --mode 0777 log/
```
and

```
cd log
mkdir --mode 0777 avn-connector/
```

## Configuration items
To change the AVN node endpoint, or the port number to listen on you can update the values in `src/config/default.yaml` (when running the containers locally) or `.env` when running in a docker container.

## Running container
To run the container, from the `docker` folder run:
```
./start
```
or
```
./start && docker logs -f avn-connector_1
```

To stop, run:
```
./stop
```

If everything is running correctly, you should see a similar message to this: `EC2 avn-connector listening on port 5000` (The port number could be different)

## Debugging the container
When running the container, the endpoint is accessible in the same place as running the code from the command line, ie, `localhost:port`

It is possible to access the logs of the running container to assist in debugging:
```
docker logs -f avn-connector_1
```

Be careful when specifying variables in the `.env` file. The raw seed of an account must be specified without quotes, whereas in the `.yaml` file it can have quotes.

## Formatting code
Before opening a PR, remember to run `npm run format` to apply automatic formatting to your javascript code files and check-in any changes. This will ensure code structure and format is consistent.

## Deploying a new version
While in DEV mode, to deploy a new version on the EC2 instance, you should:
 - Stop the containers by running `./stop` from the `docker` folder
 - Get the latest version of the code from github by running `git pull` from anywhere in the `avn-gateway-api` folder. This will pull from `main` by default
 - Start the containers by running `./start` from the `docker` folder

## Logging
The avn-connector logs running in kuberentes will be output as JSON and forwarded to cloudwatch. A JSON structure ensures that our logs can be searched and indexed by cloudwatch.

avn-connector logs can be queried in cloudwatch using the cloudwatch insights api, avn-connector queries must be done over the log group `/aws/eks/fluentbit-cloudwatch/logs`, the query syntax documentation can be found [here](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax.html).
An example query for searching for the most recent avn-connector logs:

```
fields @timestamp, data.level, @message
| sort @timestamp desc
| filter `kubernetes.labels.app` = "avn-connector"
```
In the above example `@timestamp` and `@message` are cloudwatch supplied fields, `@message` containing all the log data. `data.level` is supplied by log4js and is indexed for searching in CloudWatch. Filtering error messages can be done with the following:

```
fields @timestamp, data.level, @message
| sort @timestamp desc
| filter `kubernetes.labels.app` = "avn-connector"
| filter data.level = "ERROR"
```

We can search over any json field supplied by the logs, they will always be nested under `data`. Eg, we can do a search by the avnQueryRequest palletName:

```
fields @timestamp, data.level, @message
| sort @timestamp desc
| filter `kubernetes.labels.app` = "avn-connector"
| filter data.avnQueryRequest.palletName = "avnProxy"
```

We can also search over the `@message` attribute for the same data, but this will be a slower query and might return more data that we want. Heres the above query with a broader scope:

```
fields @timestamp, data.level, @message
| sort @timestamp desc
| filter `kubernetes.labels.app` = "avn-connector"
| filter @message like "avnProxy"
```

## Vault

Vault is used to store Relayer and Payer private keys. When creating an account and signing, vault requires a username in order to pick the correct keypair.

For payers, the username has this format: 'GatewayPayer_' + Postgres vault Id. e.g. `GatewayPayer_1add50e8-bff0-469e-983d-e43edc32a5cc`, `GatewayPayer_1add50e8-bff0-469e-983d-e43edc32a5ce`.

**This means its important to remove/reset vault if the payer database is reset. Any funds in those accounts will be lost so please be careful before resetting vault**

For relayers, the username is the relayer public key (this will be updated to match the payer setup soon).