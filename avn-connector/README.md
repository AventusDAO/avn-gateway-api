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

## Redis logic

We use `ioredis` to access the Redis API and manipulate the database. In some cases, we extend the API by creating new commands, which is done using Lua scripts. Because we are not experts in this, and may have to debug the code later, this section has a brief explanation of what the commands are and how they behave.

- We access the Redis API by connecting to a Redis database and obtaining a `redisClient` object
- We define new commands with `redisClient.defineCommand('addzrangebyscore', {...}`. The definition block includes several fields.
  - `numberOfKeys:` in our examples, these represent data structures (in particular sorted sets) that we manipulate with the command. 
  - `lua`: This is Lua code that implements the command.
  - Keys are accessible in the Lua script via the array `KEYS`. Indices are 1-based. 
  - Other arguments are accessible via the array `ARGV`, which is also 1-based.
  - In our cases (and probably always) keys are passed before the rest of the arguments.
- We can make multiple calls to Redis with a single overhead, by using pipelines. Pipelines can be combined with transactional behaviour by using `multi`.
  - Start transaction: call `redis.multi()`. This returns a pipeline.
  - Add steps to the transaction: call `.<redis function>` after the previous step in the pipeline.
  - Execute the steps in the transaction: call `.exec()`. It is possible to pass a callback function to handle any errors and implement rollbacks.
  - The return of the whole pipeline is an array with a response for each executed step.
- Some notes of Lua script:
  - `unpack`: converts an array into a multitude of several results. Similar to the JS `...` operator. It can be used to convert an array into a series of arguments for a function.
  - `table`: is a library that allows to operate on arrays, for example obtaining the length (`getn`) or adding (`table.insert`) and removing (`table.remove`) elements.
  - numbers appear to be represented in a structure that contains type and value. For that reason, we have to extract the value with `[1]`.

### Notes on polling algorithm

The following give some more detail about the algorithm to obtain the next transactions to check.

- `addzrangebyscore(PENDING_TX_KEY.CHECKING, PENDING_TX_KEY.ALL, '-inf', timeNow)`
    Selects all the elements in `PENDING_TX_KEY.CHECKING` whose score is smaller (ie older) than the current time. This means they have expired.
    These elements may be more than `MAX_PENDING_TX_TO_CHECK`. All of them are z-added to `PENDING_TX_KEY.ALL`, but since this is the master set, they should already be all in there. The effect of calling ZADD on them again is to update their score (ie expiry) to the value they have in `PENDING_TX_KEY.CHECKING`.

- `zremrangebyscore(PENDING_TX_KEY.CHECKING, '-inf', timeNow)`
    Selects the same range of the previous command, but removes it from the `PENDING_TX_KEY.CHECKING` list. This has the effect of making these transactions eligible for selection in the next round (that is about to start), depending on how they compare to the other members of `PENDING_TX_KEY.ALL`

- `zdiffstore(PENDING_TX_KEY.NEXT, 2, PENDING_TX_KEY.ALL, PENDING_TX_KEY.CHECKING)`
    Computes the set `PENDING_TX_KEY.ALL - PENDING_TX_KEY.CHECKING` (set difference) and places the result in `PENDING_TX_KEY.NEXT`.
   `PENDING_TX_KEY.NEXT` is cleared before receiving the results. At any one point, this has all the keys that we are not checking yet.
   Nothing is removed from the master list.
   
- `nextzsubset(PENDING_TX_KEY.NEXT, PENDING_TX_KEY.CHECKING, MAX_PENDING_TX_TO_CHECK, expiry)`
    (Our implementation)
    Extracts up to `MAX_PENDING_TX_TO_CHECK` transactions from `PENDING_TX_KEY.NEXT`.
    These are sorted by their expiry, from the smallest (oldest) to largest (newest). Transactions with the same expiry are sorted alphabetically.
    The selected transactions are added to `PENDING_TX_KEY.CHECKING` with an updated expiry, equal to the current time plus the Expiration Window.

In essence, the algorithm does this:
   - [invariant] all the requests are stored in `PENDING_TX_KEY.ALL`
   - [invariant] all the requests we are currently checking are stored in `PENDING_TX_KEY.CHECKING`
   in each request:
   - Update in the main list (`PENDING_TX_KEY.ALL`) the expiration time of the transactions that have expired
   - Clear all the expired pending (`PENDING_TX_KEY.CHECKING`) transactions. 
   - These are selectable again on the next (which is about to start) round but due to their new expiry, they should now be selected last
   - Place all the keys we are not checking yet in the list of next requests we are going to check: `PENDING_TX_KEY.NEXT`
   - Take the first 250 records (or less if not available) from the `PENDING_TX_KEY.NEXT` set and put them in `PENDING_TX_KEY.CHECKING`

