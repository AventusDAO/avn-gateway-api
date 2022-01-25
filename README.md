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
    -d '{"jsonrpc":"2.0", "method":"getAvtContractAddress", "params":[], "id":1}'
```

**RESULT FIELDS** \
`VALUE` - string value of AVT contract ethereum address

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "0x405df1b38510c455ef81500a3dc7e9ae599e18f6"
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
    -d '{"jsonrpc":"2.0", "method":"getAvtBalance", "params":[{"accountId":"5GLVUNb9oKLesAjDt17X1N49xyp2fr62sKPAKLgmmNbDB9MH"}], "id":1}'
```

**RESULT FIELDS** \
`VALUE` - string integer value of the current AVT balance for the account in its smallest denomination

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
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
`accountId` *[required]* - a string representing the public key or SS58 address of the account to check for token balance \
`token` *[required]* - a hex string representing the token ID (20 bytes) of the token being checked

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/query \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"getTokenBalance", "params":[{"accountId":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "token":"0x2adce7ada36d86253aa63bcf4aad9f84ccb9480e"}], "id":1}'
```

**RESULT FIELDS** \
`VALUE` - string integer value of the current token balance for the account in its smallest denomination

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
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
    -d '{"jsonrpc":"2.0", "method":"getAccountNonce", "params":[{"accountId":"5GLVUNb9oKLesAjDt17X1N49xyp2fr62sKPAKLgmmNbDB9MH"}], "id":1}'
```

**RESULT FIELDS** \
`VALUE` - string integer value of the current account nonce

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
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
    -d '{"jsonrpc":"2.0", "method":"getAccountPaymentNonce", "params":[{"accountId":"5GLVUNb9oKLesAjDt17X1N49xyp2fr62sKPAKLgmmNbDB9MH"}], "id":1}'
```

**RESULT FIELDS** \
`VALUE` - string integer value of the current account payment nonce

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
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
    -d '{"jsonrpc":"2.0", "method":"getNftNonce", "params":[{"nftId":"0x4184aa1d0e5a1a44d36d92b02ad07ab4285a43086f538a7e5b7d5cbd858e0e71"}], "id":1}'
```

**RESULT FIELDS** \
`VALUE` - string integer value of the current nonce for the NFT

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
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
`externalRef` *[required]* - a unique string representing the NFT's external reference

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/query \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"getNftId", "params":[{"externalRef":"my_unique_nft_2022-01-17T12:15:31Z"}], "id":1}'
```

**RESULT FIELDS** \
`VALUE` - hex string value representing the NFT ID

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
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
    -d '{"jsonrpc":"2.0", "method":"getNftOwner", "params":[{"nftId":"0x4184aa1d0e5a1a44d36d92b02ad07ab4285a43086f538a7e5b7d5cbd858e0e71"}], "id":1}'
```

**RESULT FIELDS** \
`VALUE` - string integer value of the current nonce for the NFT

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
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
`relayer` *[required]* - a string representing the relayer's public key or SS58 address \
`user` *[optional]* - a string representing the user's public key or SS58 address \
`transactionType` *[optional]* - a string representing the transaction type. One of: \
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
    -d '{"jsonrpc":"2.0", "method":"getNftOwner", "params":[{"relayer":"5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", "user":"5GnPqcyiruWxK5HWVZSdvZk25y2kZjmeaSBaTvpygyLcDTCg", "transactionType":"proxyTokenTransfer"}], "id":1}'
```

**RESULT FIELDS** \
`VALUE` - string integer value of the current relayer fee for user and type \
OR \
`OBJECT`- object representing fees for relayer (generic or filtered for user if passed)

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "5000000000000000"
}

OR

{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "proxyAvtTransfer": "7000000000000000",
    "proxyTokenTransfer": "7000000000000000",
    "proxyMintSingleNft": "7000000000000000",
    "proxyListNftOpenForSale": "7000000000000000",
    "proxyTransferFiatNft": "7000000000000000",
    "proxyCancelListFiatNft": "7000000000000000"
  }
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
`relayer` *[required]* - a string representing the relayer's SS58 address \
`signer` *[required]* - a string representing the sender's SS58 address \
`recipient` *[required]* - a string representing the recipient's SS58 address \
`token` *[required]* - a hex string representing the token ID (20 bytes) of the AVT contract \
`amount` *[required]* - a string integer value representing the amount (in atto AVT) being transferred \
`proxySignature` *[required]* - a proof signed by the sender/signer account allowing the transaction to be proxied \
`feePaymentSignature` *[required]* - a proof signed by the sender/signer account allowing the relayer fees to be paid \
`paymentNonce` *[required]* - string integer value of the current account payment nonce

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/send \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"transferAvt", "params":[{relayer":"5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", signer":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", recipient":"5FgyNN84CzQfwHBUJWvQkr36hiQYEXjDhcUYVx9tCTdgqosF", token":"0x405df1b38510c455ef81500a3dc7e9ae599e18f6", amount":"20000", proxySignature":"0xc2f5deeede54698bffd1779532cf66590ff5302ea624b5d3b8e72d5a949e90027eed2a19f2a12161c293204dbb1ccc4032e4248760f6385a83d5e44188cf9d8b", feePaymentSignature":"0xde49e7ab095debda05f86a122d064d24bc9c31360d1e5ebc1357076918ca78465a5428f77507f966531e29eee43070611d07f5a1632c11ff1741c3c12b22db83", paymentNonce":"200"}], "id":1}'
```

**RESULT FIELDS** \
`VALUE` - a request ID that can be queried for the transaction's status

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "540aef9d-5798-41c0-8f43-a6eb3986a3e0"
}
```

#### transferToken
Transfers the specified amount of an ERC20 or ERC777 token, from the sender account to the destination account, using a relayer account

**REQUEST**\
`POST https://AVN-API-URL/send`

**HEADERS**\
`Content-Type: application/json`\
`Authorization': bearer <awtToken>`

**REQUEST PARAMS**\
`relayer` *[required]* - a string representing the relayer's SS58 address \
`signer` *[required]* - a string representing the sender's SS58 address \
`recipient` *[required]* - a string representing the recipient's SS58 address \
`token` *[required]* - a hex string representing the token ID (20 bytes) of the token being checked \
`amount` *[required]* - a string integer value representing the amount (in lowest fraction) of the token being transferred \
`proxySignature` *[required]* - a proof signed by the sender/signer account allowing the transaction to be proxied \
`feePaymentSignature` *[required]* - a proof signed by the sender/signer account allowing the relayer fees to be paid \
`paymentNonce` *[required]* - string integer value of the current account payment nonce

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/send \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"transferToken", "params":[{relayer":"5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", signer":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", recipient":"5FgyNN84CzQfwHBUJWvQkr36hiQYEXjDhcUYVx9tCTdgqosF", token":"0xb130395ae89acbe32999f8eb6e6114a56d676199", amount":"1000000", proxySignature":"0x883e4300581dcaf3373c81eff1ec86776c58aa12fd184d4500d1aab8b7832076484d967ca01c96e7ab6d20903145c9efebac38ed521f30fe52da2e27beecf08f", feePaymentSignature":"0x7cff997be6fb98db949da0eceee2480b46a3b3aeaf4dbc7862bf6617a4c23319f666dfc2bb9e9a365ffd67ab279d980a0139fa6ce0165cdd76aaf555e7a1ba80", paymentNonce":"199"}], "id":1}'
```

**RESULT FIELDS** \
`VALUE` - a request ID that can be queried for the transaction's status

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "8b62441c-e032-46e3-bd1d-0f8a0a764442"
}
```

#### proxyMintSingleNft
Mints a single NFT to the sender

**REQUEST**\
`POST https://AVN-API-URL/send`

**HEADERS**\
`Content-Type: application/json`\
`Authorization': bearer <awtToken>`

**REQUEST PARAMS**\
`relayer` *[required]* - a string representing the relayer's \
`signer` *[required]* - a string representing the sender's \
`externalRef` *[required]* - a unique string representing the NFT's external reference \
`royalties` *[optional]* - an array of royalty rates with percentages set in parts per million - accepts empty array if no royalties\
`t1Authority` *[required]* - a hex string representing the 20 byte Ethereum address of the relevant authority \
`proxySignature` *[required]* - a proof signed by the sender/signer account allowing the transaction to be proxied \
`feePaymentSignature` *[required]* - a proof signed by the sender/signer account allowing the relayer fees to be paid \
`paymentNonce` *[required]* - string integer value of the current account payment nonce

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/send \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"proxyMintSingleNft", "params":[{relayer":"5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", signer":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", externalRef":"my-unique-ref-2022-01-18T10:32:45.199Z", "royalties": [{"recipient_t1_address":"0xf8f77379A1C6b5CA66702b5943c5b229E310Ec03", "rate": {"parts_per_million":"10000"}}], t1Authority":"0xd6ae8250b8348c94847280928c79fb3b63ca453e", proxySignature":"0xd4d20c5be0943cd1e784b7d83f7bf69d1c2419411c1b6b6d60c1e6d2c636742c30f44100d0fe24717104cad467890272d47a36f8daf497ebd2ec3ed106c58d8f", feePaymentSignature":"0x4e4ec2190d44765d1b5fa88f6aabbf87744ef964c171f0ec48763fcfbc99e47e9b0ccd633403f75068604cf3b94336c7e93a56b13a0973d181432d381b5b0f8a", paymentNonce":"201"}], "id":1}'
```

**RESULT FIELDS** \
`VALUE` - a request ID that can be queried for the transaction's status

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "a3ef1c40-c1be-4beb-9953-357d0ab504a9"
}
```

#### proxyListNftOpenForSale
Lists an NFT as open for sale in a particular market

**REQUEST**\
`POST https://AVN-API-URL/send`

**HEADERS**\
`Content-Type: application/json`\
`Authorization': bearer <awtToken>`

**REQUEST PARAMS**\
`relayer` *[required]* - a string representing the relayer's SS58 address \
`signer` *[required]* - a string representing the sender's SS58 address \
`nftId` *[required]* - a string representing the NFT ID (32 bytes) to check for nonce \
`market` *[required]* - an integer enum representing the market to list the NFT on (1 = Ethereum, 2 = Fiat)\
`proxySignature` *[required]* - a proof signed by the sender/signer account allowing the transaction to be proxied \
`feePaymentSignature` *[required]* - a proof signed by the sender/signer account allowing the relayer fees to be paid \
`paymentNonce` *[required]* - string integer value of the current account payment nonce

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/send \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"proxyListNftOpenForSale", "params":[{relayer":"5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", signer":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", nftId":"0x2c94a703a7b01f0c2d1eed5ccf82b9cbadd0bdd5e4e5283ddf01b249586181c2", market": 2, proxySignature":"0xc695f01932ce42204d9a0102e74d32d3d43f4ac6a9d615647aec29f68c707e42dc372d29fbb2d0d303d4b5d184fbe294ce5e06c93d9771a56cfe7533e0cdb488", feePaymentSignature":"0x02529e00606006ef98d70e8c32cd6a495faf362767366d01060a4fe43c1c5410f4c5260dde125da581b772909b5ed2756b83c71a5ef6568a36a79ab565cd158e", paymentNonce":"205"}], "id":1}'
```

**RESULT FIELDS** \
`VALUE` - a request ID that can be queried for the transaction's status

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "04a3eae5-54e7-4708-9bf9-a172f06453f7"
}
```

#### proxyTransferFiatNft
Transfers an NFT that is currently listed for sale in fiat

**REQUEST**\
`POST https://AVN-API-URL/send`

**HEADERS**\
`Content-Type: application/json`\
`Authorization': bearer <awtToken>`

**REQUEST PARAMS**\
`relayer` *[required]* - a string representing the relayer's SS58 address \
`signer` *[required]* - a string representing the sender's SS58 address \
`nftId` *[required]* - a string representing the NFT ID (32 bytes) to check for nonce \
`recipient` *[required]* - a hex string representing the recipient's public key \
`proxySignature` *[required]* - a proof signed by the sender/signer account allowing the transaction to be proxied \
`feePaymentSignature` *[required]* - a proof signed by the sender/signer account allowing the relayer fees to be paid \
`paymentNonce` *[required]* - string integer value of the current account payment nonce

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/send \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"proxyTransferFiatNft", "params":[{relayer":"5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", signer":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", nftId":"0x3044598a96da039d27802b300ba6197d6a023752efaccf598e62516f6ee7587c", recipient":"5FgyNN84CzQfwHBUJWvQkr36hiQYEXjDhcUYVx9tCTdgqosF", proxySignature":"0xaa3b454549de3a941e19293c0da9e47e83b920df232d5db56d5912f83b1e0c43083b1103f9655c52290221bf590facd9e99a839cafc383c30567055a56c97c8a", feePaymentSignature":"0x500da1ab75346f2b4459cc2b958a3eb690a4b8c50cc1e6f3d49fe786cb6acd0be0ca93da71bbe55d11f8df8f64f3b99c2c47a053495bf6eb842ecc4fbfad6b87", paymentNonce":"212"}], "id":1}'
```

**RESULT FIELDS** \
`VALUE` - a request ID that can be queried for the transaction's status

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "5415c92b-57a5-46f7-ba79-57176afb2510"
}
```

#### proxyCancelListFiatNft
Cancels a listing for an NFT as open for sale in fiat

**REQUEST**\
`POST https://AVN-API-URL/send`

**HEADERS**\
`Content-Type: application/json`\
`Authorization': bearer <awtToken>`

**REQUEST PARAMS**\
`relayer` *[required]* - a string representing the relayer's SS58 address \
`signer` *[required]* - a string representing the sender's SS58 address \
`nftId` *[required]* - a string representing the NFT ID (32 bytes) to check for nonce \
`proxySignature` *[required]* - a proof signed by the sender/signer account allowing the transaction to be proxied \
`feePaymentSignature` *[required]* - a proof signed by the sender/signer account allowing the relayer fees to be paid \
`paymentNonce` *[required]* - string integer value of the current account payment nonce

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/send \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"proxyCancelListFiatNft", "params":[{relayer":"5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", signer":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", nftId":"0x899697fff9eccfb4de41ad689334751f28a7b5c026e9cf23c4e8ddecb11dcf35", proxySignature":"0x7e8fb895d9c33fbfd2b0122a586d2d29a6c606ee2ca485c8eb69163be8ef7a6ddd2a52e6802f40720e192d4ca407d657cdfa703a8ce502e9c4f0feedfc3e5e8b", feePaymentSignature":"0xaae7983775fc1a5bc04b500af156dcba343f1d305549737821b7e31a12f6ce430941856c1259d520759548281afd465b3d66b7e48e72fc2c8c0a3a5bb9f8fa87", paymentNonce":"209"}], "id":1}'
```

**RESULT FIELDS** \
`VALUE` - a request ID that can be queried for the transaction's status

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "b043df72-5636-49a6-999c-aad1fa574bc5"
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
`requestId` *[required]* - string representing the request ID

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/poll \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"requestState", "params":[{"requestId":"410fe1c5-5deb-4a52-b89d-8bc9fc682415"}], "id":1}'
```

**RESULT FIELDS** \
`VALUE` - string detailing the current status:
```
'Pending'
'Rejected'
'Processed'
'Transaction not found'
```

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "Processed"
}
```

## Testing
From the root of the codebase install the dependencies:
```
npm install
```

There are a few different options to run tests. All of them can be run against different environments of the gateway. These are specified by a gateway option, that should match the name of a config file (minus the extension).
The configuration files for both gateway and AVN accounts are stored, from the root folder, at this location `./avn-api/config/`.
AVN test accounts are currently shared between different chains.

Common options are: `sandbox`, `cba`, `testnet`.

To run smoke tests, type:
```
npm run smokeTests [gateway]
```

To run all the api tests for a specified gateway:
```
npm run apiTests [gateway]
```

It is also possible to run individual test files. These require two parameters (test file and gateway) and so require a more careful syntax
`npm run solo [path to test file] -- --gateway [gateway]` or
`npm run solo [path to test file] -- -c [gateway]`

Example:
```
npm run solo ./avn-api/tests/queryApiTest.js -- -c sandbox

```