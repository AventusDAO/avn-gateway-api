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
./start && docker logs -f ec2_avn-connector_1
```

To stop, run:
```
./stop
```

If everything is running correctly, you should see a similar message to this: `EC2 avn-connector listening on port 3000` (The port number could be different)

## Formatting code
Before opening a PR, remember to run `npm run format` to apply automatic formatting to your javascript code files and check-in any changes. This will ensure code structure and format is consistent.