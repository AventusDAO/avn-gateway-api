### Webhooks Endpoint
Simple HTTPS server to test receiving, verifying, and logging gateway webhook events.
Utilizes [localtunnel](https://theboroer.github.io/localtunnel-www/) to expose your chosen endpoint to the internet.

#### Setup
- Install the node packages: `npm i`
- Ensure your endpoint (e.g: *https://avnwebhookstest.loca.lt*) has been registered with the Admin Portal

### Running
Start the server: `node index.js`

| Option  | Purpose                                 | Default           |
| ------: | :-------------------------------------- | :---------------- |
| `--env` | gateway environment                     | "uat"             |
| `--sub` | endpoint subdomain                      | "avnwebhookstest" |
| `--age` | max accepted message age (milliseconds) | 30000             |