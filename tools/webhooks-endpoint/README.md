## Webhooks Endpoint

Simple HTTPS server to test the receiving and logging of avn-gateway webhook events.

Uses [localtunnel](https://theboroer.github.io/localtunnel-www/) to expose your chosen endpoint (e.g: `https://my_test_endpoint_name.loca.lt`) to the internet.


### Setup

1. Install localtunnel:

    `npm i -g localtunnel`

2. Install the node packages:

    `npm i`

3. Ensure your chosen endpoint has been registered correctly via the Admin Portal.


### Running

1. Start the server by running the following command:

    `node index.js`

2. Open a separate terminal window and run:

    `lt --port 4443 --subdomain my_test_endpoint_name`

3. Sit back and relax as you begin to receive a beautiful stream of events