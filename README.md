# avn-gateway-api

## AvN API
Aventus AvN javascript API which connects to generic JSON-RPC spec

### Installation
`npm install avn-api`

### Usage
```
const AvnApi = require('avn-api');
const api = new AvnApi('https://n67ibi1ujh.execute-api.eu-west-2.amazonaws.com');
await api.init();
```
#### Running
Before running the script, set your AvN mnemonic or secret seed as an environment variable by running:
```
export SURI=<mnemonic OR secret seed>
```
examples: \
`export SURI="industry icon train animal assist park sister wrong hammer cruise faint describe"`
 \
`export SURI=0x226beb8ff69a053e0f101944d4c917819f7b9e44f1d915f3cf30dc97844262e0`

**Please note:** It's important that you keep the mnemonic/seed secret safe and not expose it anywhere else. If this data is compromised, you could lose your funds.


### AWT tokens
AWT (Aventus Web Token) is an authorisation token that is included in the header of every request sent to the api gateway.
This token is automatically generated, and included in the request header, using the environment variable (SURI) set before using the api.

If you want to test the api using a different way (curl or postman...), you can generate this token using the following code:
```
const AvnApi = require('avn-api');
const api = new AvnApi('https://n67ibi1ujh.execute-api.eu-west-2.amazonaws.com');
await api.init();

const awtToken = api.awt.generateAwtToken(<mnemonic OR secret seed>);
// you can replace <mnemonic OR secret seed> with process.env.SURI if you have already set the environment variable
```
### Queries

Note: AvN accounts can be identified by either their public key or their address. The former is represented by a 32-byte hex string. The latter is a string represented in [SS58 format](https://substrate.dev/docs/en/knowledgebase/advanced/ss58-address-format). Unless otherwise specifically noted, in the notes below, every argument that represents an AvN account can receive a value in either format.

```
// Return the total amount of AVT in the AvN:
let totalAvt = await api.query.getTotalAvt();


// Return an account's AVT balance:
const user1AvtBalance = await api.query.getAvtBalance('5GLVUNb9oKLesAjDt17X1N49xyp2fr62sKPAKLgmmNbDB9MH');
const user2AvtBalance = await api.query.getAvtBalance('0x30ccad92fa31a27621c5fdf872c0244d92b0211662c5bce869d93edf79120f2e');


// Return an account's token balance, specified by its Ethereum address:
const token = '0x2adce7ada36d86253aa63bcf4aad9f84ccb9480e';
const totalAvt = await api.query.getTokenBalance('5GLVUNb9oKLesAjDt17X1N49xyp2fr62sKPAKLgmmNbDB9MH', token);
const totalAvt = await api.query.getTokenBalance('0x30ccad92fa31a27621c5fdf872c0244d92b0211662c5bce869d93edf79120f2e', token);


// Return the nonce of an AvN account:
const user1Nonce = api.query.getAccountNonce('5GLVUNb9oKLesAjDt17X1N49xyp2fr62sKPAKLgmmNbDB9MH');
const user2Nonce = api.query.getAccountNonce('0x30ccad92fa31a27621c5fdf872c0244d92b0211662c5bce869d93edf79120f2e');

```

### Transactions

```
// Transfer an amount of AVT from the sender account to the destination account.
// This operation uses a relayer account that the sender authorises to submit the transfer:

const requestId1 = await api.send.transferAvt('5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh', '5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr','100000000000000000000');

const requestId2 = await api.send.transferAvt('0x9c2bfffc466eb9c1bad0d8393df93770468ee54b0a0f05232e4b5dde6960b004', '0x30ccad92fa31a27621c5fdf872c0244d92b0211662c5bce869d93edf79120f2e', 10);

// Transfer an amount of an ERC20 or ERC777 token from the sender account to the destination account.
// This operation uses a relayer account that the sender authorises to submit the transfer:

const requestId1 = await api.send.transferToken('5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh', '5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr', '0x2adce7ada36d86253aa63bcf4aad9f84ccb9480e', '100000000000000000000');

const requestId2 = await api.send.transferToken('0x9c2bfffc466eb9c1bad0d8393df93770468ee54b0a0f05232e4b5dde6960b004', '0x30ccad92fa31a27621c5fdf872c0244d92b0211662c5bce869d93edf79120f2e', '0x2adce7ada36d86253aa63bcf4aad9f84ccb9480e', 10);

```

### Polling

```
// Get the current state of a previously sent transaction:
const requestId3 = await api.send.transferAvt('5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh', '5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr','100');
const status = await api.poll.requestState(requestId);

```


## JSON-RPC Methods
Accessing the gateway API requires an authorisation token to be included in the request header. The format for this header should be:
`Authorization': bearer <awtToken>` where `<awtToken>` is the unique token for this request.

This token will be generated for you automatically by the library.

### Queries

#### getAvtContractAddress
Returns the 20 byte Ethereum address of the AVT token contract

**REQUEST** \
`POST https://AVN-API-URL/query`

**HEADERS** \
`Content-Type: application/json`
`Authorization': bearer <awtToken>`

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/query \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"getAvtContractAddress", "params":[], "id":0}'
```

**RESULT FIELDS** \
`VALUE` - string value of AVT contract ethereum address

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 0,
  "result": "0x0d88eD6E74bbFD96B831231638b66C05571e824F"
}
```

#### getTotalAvt
Returns the total amount of AVT in the AvN

**REQUEST** \
`POST https://AVN-API-URL/query`

**HEADERS** \
`Content-Type: application/json`
`Authorization': bearer <awtToken>`

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/query \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"getTotalAvt", "params":[], "id":1}'
```

**RESULT FIELDS** \
`TOTAL` - string integer value of the current total amount of circulating AVT in its smallest denomination

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "5100000000000000000000"
}
```

#### getAvtBalance
Returns the AVT balance of a given AvN account

**REQUEST** \
`POST https://AVN-API-URL/query`

**HEADERS** \
`Content-Type: application/json`
`Authorization': bearer <awtToken>`

**REQUEST PARAMS** \
`accountId` *[required]* - a string representing the public key or SS58 address of the account to check for AVT balance

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/query \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"getAvtBalance", "params":[{"accountId":"5GLVUNb9oKLesAjDt17X1N49xyp2fr62sKPAKLgmmNbDB9MH"}], "id":2}'
```

**RESULT FIELDS** \
`VALUE` - string integer value of the current AVT balance for the account in its smallest denomination

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": "930009105441170202155"
}
```

#### getTokenBalance
Returns the balance of a given token for a given AvN account

**REQUEST** \
`POST https://AVN-API-URL/query`

**HEADERS** \
`Content-Type: application/json`
`Authorization': bearer <awtToken>`

**REQUEST PARAMS** \
`accountId` *[required]* - a string representing the public key or SS58 address of the account to check for token balance
`token` *[required]* - a hex string representing the token ID (20 bytes) of the token being checked \

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/query \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"getTokenBalance", "params":[{"accountId":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "token":"0x2adce7ada36d86253aa63bcf4aad9f84ccb9480e"}], "id":3}'
```

**RESULT FIELDS** \
`VALUE` - string integer value of the current token balance for the account in its smallest denomination

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": "30"
}
```

#### getAccountNonce
Returns the account nonce of a given AvN account

**REQUEST** \
`POST https://AVN-API-URL/query`

**HEADERS** \
`Content-Type: application/json`
`Authorization': bearer <awtToken>`

**REQUEST PARAMS** \
`accountId` *[required]* - a string representing the public key or SS58 address of the account to check for nonce

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/query \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"getAccountNonce", "params":[{"accountId":"5GLVUNb9oKLesAjDt17X1N49xyp2fr62sKPAKLgmmNbDB9MH"}], "id":4}'
```

**RESULT FIELDS** \
`VALUE` - string integer value of the current account nonce

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": "3"
}
```

#### getAccountPaymentNonce
Returns the payment nonce of a given AvN account

**REQUEST** \
`POST https://AVN-API-URL/query`

**HEADERS** \
`Content-Type: application/json`
`Authorization': bearer <awtToken>`

**REQUEST PARAMS** \
`accountId` *[required]* - a string representing the public key or SS58 address of the account to check for payment nonce

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/query \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"getAccountPaymentNonce", "params":[{"accountId":"5GLVUNb9oKLesAjDt17X1N49xyp2fr62sKPAKLgmmNbDB9MH"}], "id":5}'
```

**RESULT FIELDS** \
`VALUE` - string integer value of the current account nonce

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 5,
  "result": "10"
}
```

#### getNftNonce
Returns the nonce of a given NFT

**REQUEST** \
`POST https://AVN-API-URL/query`

**HEADERS** \
`Content-Type: application/json`
`Authorization': bearer <awtToken>`

**REQUEST PARAMS** \
`nftId` *[required]* - a string representing the NFT ID (32 bytes) to check for nonce

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/query \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"getNftNonce", "params":[{"nftId":"0x4184aa1d0e5a1a44d36d92b02ad07ab4285a43086f538a7e5b7d5cbd858e0e71"}], "id":6}'
```

**RESULT FIELDS** \
`VALUE` - string integer value of the current nonce for the NFT

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 6,
  "result": "3"
}
```

#### getNftId
Returns the NFT ID for a given external reference

**REQUEST** \
`POST https://AVN-API-URL/query`

**HEADERS** \
`Content-Type: application/json`
`Authorization': bearer <awtToken>`

**REQUEST PARAMS** \
`externalRef` *[required]* - a string representing the NFT's external reference

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/query \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"getNftId", "params":[{"externalRef":"my_unique_nft_2022-01-17T12:15:31Z"}], "id":7}'
```

**RESULT FIELDS** \
`VALUE` - hex string value representing the NFT ID

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 7,
  "result": "0x4184aa1d0e5a1a44d36d92b02ad07ab4285a43086f538a7e5b7d5cbd858e0e71"
}
```

#### getNftOwner
Returns the owner of a given NFT

**REQUEST** \
`POST https://AVN-API-URL/query`

**HEADERS** \
`Content-Type: application/json`
`Authorization': bearer <awtToken>`

**REQUEST PARAMS** \
`nftId` *[required]* - a hex string representing the NFT ID (32 bytes)

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/query \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"getNftOwner", "params":[{"nftId":"0x4184aa1d0e5a1a44d36d92b02ad07ab4285a43086f538a7e5b7d5cbd858e0e71"}], "id":8}'
```

**RESULT FIELDS** \
`VALUE` - string integer value of the current nonce for the NFT

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 8,
  "result": "5FgyNN84CzQfwHBUJWvQkr36hiQYEXjDhcUYVx9tCTdgqosF"
}
```

#### getRelayerFees
Returns fees for a particular relayer, optionally by user and/or transaction type

**REQUEST** \
`POST https://AVN-API-URL/query`

**HEADERS** \
`Content-Type: application/json`
`Authorization': bearer <awtToken>`

**REQUEST PARAMS** \
`relayer` *[required]* - a string representing the relayer's public key or SS58 address
`user` *[optional]* - a string representing the user's public key or SS58 address
`transactionType` *[optional]* - a string representing the transaction type. One of:
```
"proxyAvtTransfer"
"proxyTokenTransfer"
"proxyMintSingleNft"
"proxyListNftOpenForSale"
"proxyTransferFiatNft"
"proxyCancelListFiatNft"
```

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/query \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"getNftOwner", "params":[{"relayer":"5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", "user":"5GnPqcyiruWxK5HWVZSdvZk25y2kZjmeaSBaTvpygyLcDTCg", "transactionType":"proxyTokenTransfer"}], "id":9}'
```

**RESULT FIELDS** \
`VALUE` - string integer value of the current relayer fee for user and type
OR
`OBJECT`- object representing fees for relayer (generic or filtered for user if passed)
`{
    "proxyAvtTransfer": "7000000000000000",
    "proxyTokenTransfer": "7000000000000000",
    "proxyMintSingleNft": "7000000000000000",
    "proxyListNftOpenForSale": "7000000000000000",
    "proxyTransferFiatNft": "7000000000000000",
    "proxyCancelListFiatNft": "7000000000000000"
  }`

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 9,
  "result": "5000000000000000"
}

OR

{
  "proxyAvtTransfer": "7000000000000000",
  "proxyTokenTransfer": "7000000000000000",
  "proxyMintSingleNft": "7000000000000000",
  "proxyListNftOpenForSale": "7000000000000000",
  "proxyTransferFiatNft": "7000000000000000",
  "proxyCancelListFiatNft": "7000000000000000"
}
```

### Transactions

#### transferAvt
Transfers the specified amount of AVT from the sender account to the destination account, using a relayer account

**REQUEST** \
`POST https://AVN-API-URL/send`

**HEADERS** \
`Content-Type: application/json`
`Authorization': bearer <awtToken>`

**REQUEST PARAMS** \
`RELAYER ACCOUNT ID / SS58 ADDRESS` *[required]* - a string representing the relayer account\
`SENDER ACCOUNT ID / SS58 ADDRESS` *[required]* - a string representing the sender account
`DESTINATION ACCOUNT ID / SS58 ADDRESS` *[required]* - a string representing the recipient account\
`AMOUNT` *[required]* - string integer value of the current account nonce

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/send \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"transferAvt", "params":["5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", "5GLVUNb9oKLesAjDt17X1N49xyp2fr62sKPAKLgmmNbDB9MH", "5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "2"], "id":5}'
```

**RESULT FIELDS** \
`REQUEST ID` - string bytes value of the request ID

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 5,
  "result": "0x97bf91291b28c6af9cba82b5e5aee28509cde8b27610fce543723956fa8b8bc3"
}
```

#### transferToken
Transfers the specified amount of an ERC20 or ERC777 token, from the sender account to the destination account, using a relayer account

**REQUEST**\
`POST https://AVN-API-URL/send`\

**HEADERS**\
`Content-Type: application/json`\
`Authorization': bearer <awtToken>`\

**REQUEST PARAMS**\
`RELAYER ACCOUNT ID / SS58 ADDRESS` *[required]* - a string representing the relayer account\
`SENDER ACCOUNT ID / SS58 ADDRESS` *[required]* - a string representing the sender account\
`DESTINATION ACCOUNT ID / SS58 ADDRESS` *[required]* - a string representing the recipient account\
`TOKEN ADDRESS` *[required]* - hexadecimal string specifying the Ethereum address (20 bytes) of the token being transferred\
`AMOUNT` *[required]* - string integer value of the current account nonce

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/send \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"transferToken", "params":["5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", "5GLVUNb9oKLesAjDt17X1N49xyp2fr62sKPAKLgmmNbDB9MH", "5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "0x2adce7ada36d86253aa63bcf4aad9f84ccb9480e", "2"], "id":6}'
```

**RESULT FIELDS**\
`REQUEST ID` - string bytes value of the request ID

**BODY**
```
{
\"jsonrpc": "2.0",
\"id": 6,
\"result": "0x97bf91291b28c6af9cba82b5e5aee28509cde8b27610fce543723956fa8b8bc3"
}
```

### Polling

#### requestState
Gets the current state of a previously sent asynchronous transaction request

**REQUEST** \
`POST https://AVN-API-URL/poll`

**HEADERS** \
`Content-Type: application/json`
`Authorization': bearer <awtToken>`

**REQUEST PARAMS** \
`REQUEST ID` *[required]* - string bytes value of the request ID

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/poll \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"requestState", "params":["0x9f78ca5fb3fe3448295b77b42dd3695126b9bf2d414b24fcafd09886fe388283"], "id":7}'
```

**RESULT FIELDS** \
`STATUS` - string detailing the current status ('pending', 'pending and lost', 'finished', 'errored', 'unknown')

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 7,
  "result": "finished"
}
```

## Testing
From the root of the codebase install the dependencies:
```
npm install
```

Then to run all the tests for a specified gateway:
```
npm run allTestsCBA
or
npm run allTestsSandbox
```

Or to run sub tests for a specified gateway:
 - `npm run smokeTests [gateway]`: to run all the smoke tests
 - `npm run apiTests [gateway]`: to run all the api tests
 - `npm run avn-connectorTests`: to run all the backend
 - `npm run lambdaTests`: to run all the lambda tests

Configuration:
The configuration files for both gateway and AVN accounts are stored from the root folder `./avn-api/config/`.
AVN test accounts are currently shared between different chains.