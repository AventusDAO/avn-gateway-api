## Webhooks Endpoint

Simple HTTPS server to test receiving, verifying, and logging avn-gateway webhook events.

Uses [localtunnel](https://theboroer.github.io/localtunnel-www/) to expose your chosen endpoint to the internet.


### Setup

1. Install the node packages:

    `npm i`

2. Ensure your endpoint (e.g: `https://my_test_endpoint_subdomain_name.loca.lt`) has been registered with the Admin Portal.


### Running

1. Start the server by running the following command (defaults to `avnwebhookstest` and the dev gateway):

    `node index.js [endpoint_subdomain_name] [gateway_url]`

2. Sit back and relax as you begin to receive a beautiful stream of events