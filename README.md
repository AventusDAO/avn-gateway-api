[![avn-gateway](https://github.com/Aventus-Network-Services/avn-gateway-api/actions/workflows/lambdas.yml/badge.svg?branch=main)](https://github.com/Aventus-Network-Services/avn-gateway-api/actions/workflows/lambdas.yml)

[![avn-connector](https://github.com/Aventus-Network-Services/avn-gateway-api/actions/workflows/connector.yml/badge.svg?branch=main)](https://github.com/Aventus-Network-Services/avn-gateway-api/actions/workflows/connector.yml)

# avn-gateway-api

## AvN-API
Aventus AvN javascript API which connects to generic JSON-RPC spec.\
Please see the [avn-api](https://www.npmjs.com/package/avn-api) NPM module for JS functionality and example usage.

## Running
Before using the api, set the user's AvN mnemonic or secret seed as the **AVN_SURI** environment variable: `export AVN_SURI=<mnemonic OR secret seed>``
examples:
- `export AVN_SURI="industry icon train animal assist park sister wrong hammer cruise faint describe"`
- `export AVN_SURI=0x226beb8ff69a053e0f101944d4c917819f7b9e44f1d915f3cf30dc97844262e0`

**Note:** _It's important to keep the mnemonic/seed secret safe and not expose it anywhere else. If compromised you could lose all your funds._

#### Offline mode
Running the api in offline mode exposes AWT token generation and proof generation, useful for configuring JSON-RPC calls, along with account generation tools.\
To run in offline mode:
```
const AvnApi = require('avn-api');
const api = new AvnApi();
await api.init();
```

#### Online mode
Passing a gateway URL enables the full api:
```
const AvnApi = require('avn-api');
const api = new AvnApi('https://sandbox.gateway.aventus.io');
await api.init();
```

### AWT tokens
AWT (Aventus Web Token) is an authorisation token that must be included in the header of every request sent to the gateway.\
The format for this header should be: `Authorization': bearer <awtToken>` (where `<awtToken>` is the unique token for this request).\
The tokens are generated and refreshed automatically by the api but can also be generated manually for use with JSON-RPC:
```
const awtToken = api.awt.generateAwtToken();
```

### Proofs
Proofs are generated internally by the api but can also be constructed manually for JSON-RPC usage. \
Each send transaction requires 2 types of proof:
1) a **proxySignature** confirming the transaction details. This is signed by the transaction originator (ie: the user).
2) a **feePaymentSignature** signed by either the user or any party willing to pay the required relayer sending fee (ie: the payer).

##### Proxy Signature Generation
Ensure you suply the relevant transaction type and correct nonce (which can be retrieved by calling either [getNonce](#getNonce) or [getNftNonce](#getNftNonce) ).\
The api exposes the following methods:
  - `api.proxy.generateProxySignature('proxyAvtTransfer', { relayer, user, recipient, token, amount, nonce })`\
  _for nonce call [getNonce](#getNonce) with `accountId` = user, `nonceType` = 'token'_\

  - `api.proxy.generateProxySignature('proxyTokenTransfer', { relayer, user, recipient, token, amount, nonce })`\
  _for nonce call [getNonce](#getNonce) with `accountId` = user, `nonceType` = 'token'_\

  - `api.proxy.generateProxySignature('proxyConfirmTokenLift', { relayer, eventType, ethereumTransactionHash, nonce })`\
  _for nonce call [getNonce](#getNonce) with `accountId` = user, `nonceType` = 'confirmation'_\

  - `api.proxy.generateProxySignature('proxyTokenLower', { relayer, user, token, amount, t1Recipient, nonce })`\
  _for nonce call [getNonce](#getNonce) with `accountId` = user, `nonceType` = 'token'_\

  - `api.proxy.generateProxySignature('proxyMintSingleNft', { relayer, externalRef, royalties, t1Authority })`\
  _no nonce required_

  - `api.proxy.generateProxySignature('proxyListNftOpenForSale', { relayer, user, nftId, market, nonce })`\
  _for nonce call [getNftNonce](#getNftNonce) with nftId = nftId_\

  - `api.proxy.generateProxySignature('proxyTransferFiatNft', { relayer, nftId, recipient, nonce })`\
  _for nonce call [getNftNonce](#getNftNonce) with nftId = nftId_\

  - `api.proxy.generateProxySignature('proxyCancelListFiatNft', { relayer, nftId, nonce })`\
  _for nonce call [getNftNonce](#getNftNonce) with nftId = nftId_\

  - `api.proxy.generateProxySignature('proxyBond', { relayer, user, amount, nonce })`\
  _for nonce call [getNonce](#getNonce) with `accountId` = user, `nonceType` = 'staking'_\

  - `api.proxy.generateProxySignature('proxyNominate', { relayer, targets, nonce })`\
  _for nonce call [getNonce](#getNonce) with `accountId` = user, `nonceType` = 'staking'_\

  - `api.proxy.generateProxySignature('proxyIncreaseStake', { relayer, amount, nonce })`\
  _for nonce call [getNonce](#getNonce) with `accountId` = user, `nonceType` = 'staking'_\

  - `api.proxy.generateProxySignature('proxyUnstake', { relayer, amount, nonce })`\
  _for nonce call [getNonce](#getNonce) with `accountId` = user, `nonceType` = 'staking'_\

  - `api.proxy.generateProxySignature('proxyWithdrawUnlocked', { relayer, nonce })`\
  _for nonce call [getNonce](#getNonce) with `accountId` = user, `nonceType` = 'staking'_\

  - `api.proxy.generateProxySignature('proxyPayoutStakers', { relayer, era, nonce })`\
  _for nonce call [getNonce](#getNonce) with `accountId` = user, `nonceType` = 'staking'_

##### Fee Payment Signature Generation
The fee payment signature is the same for all transactions, only the `transactionType differs` (must match the proxy signature type)
  - `api.proxy.generateFeePaymentSignature({ relayer, user, proxySignature, relayerFee, paymentNonce })`\
  _for relayerFee call [getNonce](#getNonce) with `user` = payer, `transactionType` = eg: 'proxyCancelListFiatNft'_
  _for nonce call [getNonce](#getNonce) with `accountId` = payer, `nonceType` = 'payment'_

### AvN accounts format
AvN accounts can be identified by either their public key or their address. The former is represented by a 32-byte hex string. The latter is a string represented in [SS58 format](https://substrate.dev/docs/en/knowledgebase/advanced/ss58-address-format).\
Unless otherwise specifically noted below, every argument that represents an AvN account can receive either format.
New accounts can be generated offline using:
```
console.log(api.utils.generateNewAccount());
```

## JSON-RPC Methods

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
    -d '{"jsonrpc":"2.0", "method":"getAvtContractAddress", "params":{}, "id":1}'
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

#### getAvnContractAddress
Returns the 20 byte Ethereum address of the AVN bridging contract

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
    -d '{"jsonrpc":"2.0", "method":"getAvnContractAddress", "params":{}, "id":1}'
```

**RESULT FIELDS** \
`VALUE` - string value of AVN contract ethereum address

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "0x2130f4987ff4c192ff04cad07ae7aad65009f5a"
}
```

#### getNftContractAddress
Returns the 20 byte Ethereum address of the NFT Listings contract

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
    -d '{"jsonrpc":"2.0", "method":"getNftContractAddress", "params":{}, "id":1}'
```

**RESULT FIELDS** \
`VALUE` - string value of NFT contract ethereum address

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "0xb8608e90ae5bfbdf6156558a5231e0b291a74330"
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
    -d '{"jsonrpc":"2.0", "method":"getTotalAvt", "params":{}, "id":1}'
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
    -d '{"jsonrpc":"2.0", "method":"getAvtBalance", "params":{"accountId":"5GLVUNb9oKLesAjDt17X1N49xyp2fr62sKPAKLgmmNbDB9MH"}, "id":1}'
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
    -d '{"jsonrpc":"2.0", "method":"getTokenBalance", "params":{"accountId":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "token":"0x2adce7ada36d86253aa63bcf4aad9f84ccb9480e"}, "id":1}'
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

#### getNonce
Returns the nonce of a given AvN account and nonce type

**REQUEST** \
`POST https://AVN-API-URL/query`

**HEADERS** \
`Content-Type: application/json`
`Authorization': bearer <awtToken>`

**REQUEST PARAMS** \
`accountId` *[required]* - a string representing the public key or SS58 address of the account to check for nonce
`nonceType` *[required]* - a string representing the nonce type. One of:
```
"token"
"payment"
"staking"
"confirmation"
```

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/query \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"getNonce", "params":{"accountId":"5GLVUNb9oKLesAjDt17X1N49xyp2fr62sKPAKLgmmNbDB9MH", "nonceType":"token"}, "id":1}'
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
    -d '{"jsonrpc":"2.0", "method":"getNftNonce", "params":{"nftId":"0x4184aa1d0e5a1a44d36d92b02ad07ab4285a43086f538a7e5b7d5cbd858e0e71"}, "id":1}'
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
    -d '{"jsonrpc":"2.0", "method":"getNftId", "params":{"externalRef":"my_unique_nft_2022-01-17T12:15:31Z"}, "id":1}'
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
    -d '{"jsonrpc":"2.0", "method":"getNftOwner", "params":{"nftId":"0x4184aa1d0e5a1a44d36d92b02ad07ab4285a43086f538a7e5b7d5cbd858e0e71"}, "id":1}'
```

**RESULT FIELDS** \
`VALUE` - string integer value of the current owner of the NFT

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "5FgyNN84CzQfwHBUJWvQkr36hiQYEXjDhcUYVx9tCTdgqosF"
}
```

#### getAccountInfo
Returns a breakdown of the current AVT utilisation in a given AvN account

**REQUEST** \
`POST https://AVN-API-URL/query`

**HEADERS** \
`Content-Type: application/json`
`Authorization': bearer <awtToken>`

**REQUEST PARAMS** \
`accountId` *[required]* - a string representing the public key or SS58 address of the account to check

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/query \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"getAccountInfo", "params":{"accountId":"5GLVUNb9oKLesAjDt17X1N49xyp2fr62sKPAKLgmmNbDB9MH"}, "id":1}'
```

**RESULT FIELDS** \
`totalBalance` - string integer value representing the account's total AVT balance \
`freeBalance` - string integer value representing the portion of the total that is freely usable (not staked or locked) \
`stakedBalance` - string integer value representing the portion that is staked and currently earning rewards \
`unlockedBalance` - string integer value representing the portion that is unstaked and unlocked and can be converted to free balance \
`unstakedBalance` - string integer value representing the portion that is unstaked but still currently locked

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "totalBalance": "10000000000000000",
    "freeBalance": "5000000000000000",
    "stakedBalance": "2000000000000000",
    "unlockedBalance": "1000000000000000",
    "unstakedBalance": "2000000000000000"
  }
}
```

#### getStakingStatus
Returns the staking status of the given AvN account

**REQUEST** \
`POST https://AVN-API-URL/query`

**HEADERS** \
`Content-Type: application/json`
`Authorization': bearer <awtToken>`

**REQUEST PARAMS** \
`accountId` *[required]* - a string representing the public key or SS58 address of the account to check

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/query \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"getStakingStatus", "params":{"accountId":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr"}, "id":1}'
```

**RESULT FIELDS** \
`VALUE` - string detailing the current staking status:
```
'isStaking'
'isNotStaking'
```
**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "isNotStaking"
}
```

#### getValidatorsToNominate
Returns the target validator nomination list required to create first-time staker proofs

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
    -d '{"jsonrpc":"2.0", "method":"getValidatorsToNominate", "params":{}, "id":1}'
```

**RESULT FIELDS** \
`VALUE` - array of hex strings representing the list of validator public keys

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": ["0x9c64fea89ee6743bc48fb637f4d0349d299c4254676e44ecca989d9b34690f98", "0x67dfe6abf2495977d56ef4870333c0f00b78e0a5a3b7172e4b5e7b33716f00ab", "0x1ad675be22638c4257b059941ad4556e42369f5617d51ed012aa927af22f29ca"]
}
```

#### getActiveEra
Returns the current active era to call payoutStakers with

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
    -d '{"jsonrpc":"2.0", "method":"getActiveEra", "params":{}, "id":1}'
```

**RESULT FIELDS** \
`VALUE` - string integer value of the current staking era

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "1392"
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
`transactionType` *[optional]* - a string representing the transaction type. One of:
```
"proxyAvtTransfer"
"proxyTokenTransfer"
"proxyConfirmTokenLift"
"proxyTokenLower"
"proxyMintSingleNft"
"proxyListNftOpenForSale"
"proxyTransferFiatNft"
"proxyCancelListFiatNft"
"proxyBond"
"proxyNominate"
"proxyIncreaseStake"
"proxyUnstake"
"proxyWithdrawUnlocked"
"proxyPayoutStakers"
```

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/query \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"getRelayerFees", "params":{"relayer":"5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", "user":"5GnPqcyiruWxK5HWVZSdvZk25y2kZjmeaSBaTvpygyLcDTCg", "transactionType":"proxyTokenTransfer"}, "id":1}'
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
    "proxyConfirmTokenLift": "7000000000000000",
    "proxyTokenLower": "7000000000000000",
    "proxyMintSingleNft": "7000000000000000",
    "proxyListNftOpenForSale": "7000000000000000",
    "proxyTransferFiatNft": "7000000000000000",
    "proxyCancelListFiatNft": "7000000000000000"
  }
}
```

#### getOwnedNfts
Returns an array of nft ids owned by the specified user

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
    -d '{"jsonrpc":"2.0", "method":"getOwnedNfts", "params":{"accountId":"5GLVUNb9oKLesAjDt17X1N49xyp2fr62sKPAKLgmmNbDB9MH"}, "id":1}'
```

**RESULT FIELDS** \
`VALUE` - an array of nft ids owned by the user

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
   "result": ["28864026131317024858047047269769811198288654753166303480645299416724748836052", "52485804728864026131317047269769811478198288650645299416724748836052531663034", "24748836288624858047402047269769863034806451119828865475316299416705261313170"]
}
```

### Transactions
All gateway transactions are processed via a relayer, which requires a pair of signed proofs; one to confirm the validity of the transaction and the other to confirm payment of the relayer fee

#### proxyAvtTransfer
Transfers the specified amount of AVT from the user account to the destination account

**REQUEST** \
`POST https://AVN-API-URL/send`

**HEADERS** \
`Content-Type: application/json`
`Authorization': bearer <awtToken>`

**REQUEST PARAMS** \
`relayer` *[required]* - a string representing the relayer's SS58 address \
`user` *[required]* - a string representing the user's SS58 address \
`recipient` *[required]* - a string representing the recipient's SS58 address \
`token` *[required]* - a hex string representing the token ID (20 bytes) of the AVT contract \
`amount` *[required]* - a string integer value representing the amount (in atto AVT) being transferred \
`proxySignature` *[required]* - a proof signed by the user allowing the transaction to be proxied \
`feePaymentSignature` *[required]* - a proof signed by the payer allowing the relayer fees to be paid \
`paymentNonce` *[required]* - string integer value of the current payment nonce of the payer

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/send \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"proxyAvtTransfer", "params":{"relayer":"5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", "user":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "recipient":"5FgyNN84CzQfwHBUJWvQkr36hiQYEXjDhcUYVx9tCTdgqosF", "token":"0x405df1b38510c455ef81500a3dc7e9ae599e18f6", "amount":"20000", "proxySignature":"0xc2f5deeede54698bffd1779532cf66590ff5302ea624b5d3b8e72d5a949e90027eed2a19f2a12161c293204dbb1ccc4032e4248760f6385a83d5e44188cf9d8b", "feePaymentSignature":"0xde49e7ab095debda05f86a122d064d24bc9c31360d1e5ebc1357076918ca78465a5428f77507f966531e29eee43070611d07f5a1632c11ff1741c3c12b22db83", "paymentNonce":"200"}, "id":1}'
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

#### proxyTokenTransfer
Transfers the specified amount of an ERC20 or ERC777 token, from the user account to the destination account

**REQUEST**\
`POST https://AVN-API-URL/send`

**HEADERS**\
`Content-Type: application/json`\
`Authorization': bearer <awtToken>`

**REQUEST PARAMS**\
`relayer` *[required]* - a string representing the relayer's SS58 address \
`user` *[required]* - a string representing the user's SS58 address \
`recipient` *[required]* - a string representing the recipient's SS58 address \
`token` *[required]* - a hex string representing the token ID (20 bytes) of the token being checked \
`amount` *[required]* - a string integer value representing the amount (in lowest fraction) of the token being transferred \
`proxySignature` *[required]* - a proof signed by the user allowing the transaction to be proxied \
`feePaymentSignature` *[required]* - a proof signed by the payer allowing the relayer fees to be paid \
`paymentNonce` *[required]* - string integer value of the current payment nonce of the payer

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/send \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"proxyTokenTransfer", "params":{"relayer":"5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", "user":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "recipient":"5FgyNN84CzQfwHBUJWvQkr36hiQYEXjDhcUYVx9tCTdgqosF", token":"0xb130395ae89acbe32999f8eb6e6114a56d676199", "amount":"1000000", "proxySignature":"0x883e4300581dcaf3373c81eff1ec86776c58aa12fd184d4500d1aab8b7832076484d967ca01c96e7ab6d20903145c9efebac38ed521f30fe52da2e27beecf08f", "feePaymentSignature":"0x7cff997be6fb98db949da0eceee2480b46a3b3aeaf4dbc7862bf6617a4c23319f666dfc2bb9e9a365ffd67ab279d980a0139fa6ce0165cdd76aaf555e7a1ba80", "paymentNonce":"199"}, "id":1}'
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

### proxyConfirmTokenLift
Trigger the AvN confirmation of a lift operation that has previously occurred on Ethereum

**REQUEST**\
`POST https://AVN-API-URL/send`

**HEADERS**\
`Content-Type: application/json`\
`Authorization': bearer <awtToken>`

**REQUEST PARAMS**\
`relayer` *[required]* - a string representing the relayer's SS58 address \
`user` *[required]* - a string representing the user's SS58 address \
`eventType` *[required]* - the integer value 1 - representing the enum value for a Lifted event type \
`ethereumTransactionHash` *[required]* - a string representing the 32 byte Ethereum transaction hash of the lift \
`proxySignature` *[required]* - a proof signed by the user allowing the transaction to be proxied \
`feePaymentSignature` *[required]* - a proof signed by the payer allowing the relayer fees to be paid \
`paymentNonce` *[required]* - string integer value of the current payment nonce of the payer

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/send \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"proxyConfirmTokenLift", "params":{"relayer":"5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", "user":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "eventType": 1, "ethereumTransactionHash": "0xad7190f148fbd57b2a615c964b3ad2dcf17574ebf0d1c9778f6aab09657814ca", "proxySignature":"0x362f3e1f9f8f8802b84a54562be6ae1451a959b84b037f98604d9fa78d4f9ab068d6385baeaa16cd3a060829d5f776444af59d07c0755483acca220007422319", "feePaymentSignature":"0x5f3f0ca4ed32b4172998f816cf5e296553b29ec042a7b564c493568d3cf89687f08b9b48b17ca84f1935e8d844a9f133a239df12d7fa3d0fda58bb9a9d65eb10", "paymentNonce":"314"}, "id":1}'
```

**RESULT FIELDS** \
`VALUE` - a request ID that can be queried for the transaction's status

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "8f7f76c8-a06e-11ec-b909-0242ac120002"
}
```

#### proxyTokenLower
Triggers a "lower" of an amount of ETH (0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE) or any available ERC20 or ERC777 token, deducting the amount from the user's AvN account.\
The process is completed on Ethereum by calling the AvN tier1 contract's lower method after a summary containing the transaction has been published, in order for the recipient to receive the lowered amount.

**REQUEST**\
`POST https://AVN-API-URL/send`

**HEADERS**\
`Content-Type: application/json`\
`Authorization': bearer <awtToken>`

**REQUEST PARAMS**\
`relayer` *[required]* - a string representing the relayer's SS58 address \
`user` *[required]* - a string representing the user's SS58 address \
`t1Recipient` *[required]* - a string representing the t1 recipient's 20 byte Ethereum address \
`token` *[required]* - a hex string representing the token ID (20 bytes) of the token being checked \
`amount` *[required]* - a string integer value representing the amount (in lowest fraction) of the token being transferred \
`proxySignature` *[required]* - a proof signed by the user allowing the transaction to be proxied \
`feePaymentSignature` *[required]* - a proof signed by the payer allowing the relayer fees to be paid \
`paymentNonce` *[required]* - string integer value of the current payment nonce of the payer

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/send \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"proxyTokenLower", "params":{"relayer":"5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", "user":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "t1Recipient":"0xFad45995bc1ceE164E7565e301F5736F3eed3Bb1", "token":"0x405df1b38510c455ef81500a3dc7e9ae599e18f6", "amount":"3", "proxySignature":"0x8e38f2809d58c2a75cd0529ebb650e4447c3b192e6b9eb4a7ae346049b1e18552565e94981e3bece4bf71667b88e54c39340aa931872f1f332ab72b94cb9938c", "feePaymentSignature":"0x9ae648e3c25ba12ae2272024ad7b0ed954e2f8057c544b825f800e886b7a79213f24c884f9aac6d2cd5d0a7bff6a813140ee20e38e7374c054d31d0834250684", "paymentNonce":"10"}, "id":1}'
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
Mints a single NFT to the user

**REQUEST**\
`POST https://AVN-API-URL/send`

**HEADERS**\
`Content-Type: application/json`\
`Authorization': bearer <awtToken>`

**REQUEST PARAMS**\
`relayer` *[required]* - a string representing the relayer's SS58 address \
`user` *[required]* - a string representing the user's SS58 address \
`externalRef` *[required]* - a unique string representing the NFT's external reference \
`royalties` *[optional]* - an array of royalty rates with percentages set in parts per million - accepts empty array if no royalties\
`t1Authority` *[required]* - a hex string representing the 20 byte Ethereum address of the relevant authority \
`proxySignature` *[required]* - a proof signed by the user allowing the transaction to be proxied \
`feePaymentSignature` *[required]* - a proof signed by the payer allowing the relayer fees to be paid \
`paymentNonce` *[required]* - string integer value of the current payment nonce of the payer

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/send \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"proxyMintSingleNft", "params":{"relayer":"5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", "user":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "externalRef":"my-unique-ref-2022-01-18T10:32:45.199Z", "royalties": [{"recipient_t1_address":"0xf8f77379A1C6b5CA66702b5943c5b229E310Ec03", "rate": {"parts_per_million":"10000"}}], "t1Authority":"0xd6ae8250b8348c94847280928c79fb3b63ca453e", "proxySignature":"0xd4d20c5be0943cd1e784b7d83f7bf69d1c2419411c1b6b6d60c1e6d2c636742c30f44100d0fe24717104cad467890272d47a36f8daf497ebd2ec3ed106c58d8f", "feePaymentSignature":"0x4e4ec2190d44765d1b5fa88f6aabbf87744ef964c171f0ec48763fcfbc99e47e9b0ccd633403f75068604cf3b94336c7e93a56b13a0973d181432d381b5b0f8a", "paymentNonce":"201"}, "id":1}'
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
`user` *[required]* - a string representing the user's SS58 address \
`nftId` *[required]* - a string representing the NFT ID (32 bytes) to check for nonce \
`market` *[required]* - an integer enum representing the market to list the NFT on (1 = Ethereum, 2 = Fiat)\
`proxySignature` *[required]* - a proof signed by the user allowing the transaction to be proxied \
`feePaymentSignature` *[required]* - a proof signed by the payer allowing the relayer fees to be paid \
`paymentNonce` *[required]* - string integer value of the current payment nonce of the payer

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/send \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"proxyListNftOpenForSale", "params":{"relayer":"5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", "user":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "nftId":"0x2c94a703a7b01f0c2d1eed5ccf82b9cbadd0bdd5e4e5283ddf01b249586181c2", "market": 2, "proxySignature":"0xc695f01932ce42204d9a0102e74d32d3d43f4ac6a9d615647aec29f68c707e42dc372d29fbb2d0d303d4b5d184fbe294ce5e06c93d9771a56cfe7533e0cdb488", "feePaymentSignature":"0x02529e00606006ef98d70e8c32cd6a495faf362767366d01060a4fe43c1c5410f4c5260dde125da581b772909b5ed2756b83c71a5ef6568a36a79ab565cd158e", "paymentNonce":"205"}, "id":1}'
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
`user` *[required]* - a string representing the user's SS58 address \
`nftId` *[required]* - a string representing the NFT ID (32 bytes) to check for nonce \
`recipient` *[required]* - a hex string representing the recipient's public key \
`proxySignature` *[required]* - a proof signed by the user allowing the transaction to be proxied \
`feePaymentSignature` *[required]* - a proof signed by the payer allowing the relayer fees to be paid \
`paymentNonce` *[required]* - string integer value of the current payment nonce of the payer

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/send \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"proxyTransferFiatNft", "params":{"relayer":"5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", "user":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "nftId":"0x3044598a96da039d27802b300ba6197d6a023752efaccf598e62516f6ee7587c", "recipient":"5FgyNN84CzQfwHBUJWvQkr36hiQYEXjDhcUYVx9tCTdgqosF", "proxySignature":"0xaa3b454549de3a941e19293c0da9e47e83b920df232d5db56d5912f83b1e0c43083b1103f9655c52290221bf590facd9e99a839cafc383c30567055a56c97c8a", "feePaymentSignature":"0x500da1ab75346f2b4459cc2b958a3eb690a4b8c50cc1e6f3d49fe786cb6acd0be0ca93da71bbe55d11f8df8f64f3b99c2c47a053495bf6eb842ecc4fbfad6b87", "paymentNonce":"212"}, "id":1}'
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
`user` *[required]* - a string representing the user's SS58 address \
`nftId` *[required]* - a string representing the NFT ID (32 bytes) to check for nonce \
`proxySignature` *[required]* - a proof signed by the user allowing the transaction to be proxied \
`feePaymentSignature` *[required]* - a proof signed by the payer allowing the relayer fees to be paid \
`paymentNonce` *[required]* - string integer value of the current payment nonce of the payer

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/send \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"proxyCancelListFiatNft", "params":{"relayer":"5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", "user":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "nftId":"0x899697fff9eccfb4de41ad689334751f28a7b5c026e9cf23c4e8ddecb11dcf35", "proxySignature":"0x7e8fb895d9c33fbfd2b0122a586d2d29a6c606ee2ca485c8eb69163be8ef7a6ddd2a52e6802f40720e192d4ca407d657cdfa703a8ce502e9c4f0feedfc3e5e8b", "feePaymentSignature":"0xaae7983775fc1a5bc04b500af156dcba343f1d305549737821b7e31a12f6ce430941856c1259d520759548281afd465b3d66b7e48e72fc2c8c0a3a5bb9f8fa87", "paymentNonce":"209"}, "id":1}'
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

#### proxyStakeAvt
Stakes the specified amount of AVT, locking its free usage in order to earn rewards.\
**Note** This should only be used for _first time_ stakers - please query `getStakingStatus` to check first.\
**Note-2** The initial staking requires 2 sets of proofs, one to cover the bonding step and one to cover the nominating step

**REQUEST**\
`POST https://AVN-API-URL/send`

**HEADERS**\
`Content-Type: application/json`\
`Authorization': bearer <awtToken>`

**REQUEST PARAMS**\
`relayer` *[required]* - a string representing the relayer's SS58 address \
`user` *[required]* - a string representing the user's SS58 address \
`amount` *[required]* - a string integer value representing the full amount of AVT to stake \
`targets` *[required]* - The list of validators to nominate \
`proxyBondSignature` *[required]* - a proof signed by the user allowing the bond transaction to be proxied \
`proxyNominateSignature` *[required]* - a proof signed by the user allowing the nominate transaction to be proxied \
`bondFeePaymentSignature` *[required]* - a proof signed by the user allowing the bond relayer fees to be paid \
`nominateFeePaymentSignature` *[required]* - a proof signed by the user allowing the nominate relayer fees to be paid \
`bondPaymentNonce` *[required]* - string integer value of the payment nonce used in the bondFeePaymentSignature \
`nominatePaymentNonce` *[required]* - string integer value of the payment nonce used in the nominateFeePaymentSignature \
**Note**: nominatePaymentNonce must succeed bondPaymentNonce \


**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/send \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"proxyStakeAvt", "params":{"relayer":"5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", "user":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "amount":"0x899697fff9eccfb4de41ad689334751f28a7b5c026e9cf23c4e8ddecb11dcf35", "proxyBondSignature":"0x8cd139e3ac19d8fe217574c138ca320a73041b15527ba220280117588ad3597c20788049b4fbb6df2d96e579af68d6643c1cd4234812f8c9adb0e102a5840145",
    "proxyNominateSignature":"0x4bd139e3ac19d8fe217574c138ca320a73041b15527ba220280117588ad3597c20788049b4fbb6df2d96e579af68d6643c1cd4234812f8c9adb0e102a5840145", "bondFeePaymentSignature":"0x243ad5e9df7e5443b29de409e5668753aea836b97d73af3b491c018d11a1269ef091f712b27e75847f8e5d056a996b4186d0ee80b3eb05ef0d1991c05539b0c8","nominateFeePaymentSignature":"0x123ad5e9df7e5443b29de409e5668753aea836b97d73af3b491c018d11a1269ef091f712b27e75847f8e5d056a996b4186d0ee80b3eb05ef0d1991c05539b0c8", "bondPaymentNonce":"305", "targets": ["0x9c64fea89ee6743bc48fb637f4d0349d299c4254676e44ecca989d9b34690f98", "0x67dfe6abf2495977d56ef4870333c0f00b78e0a5a3b7172e4b5e7b33716f00ab", "0x1ad675be22638c4257b059941ad4556e42369f5617d51ed012aa927af22f29ca"]}, "id":1}'
```

**RESULT FIELDS** \
`VALUE` - a request ID that can be queried for the transaction's status

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "80ada166-e4f7-441d-9f1d-1be266a2f89c"
}
```

#### proxyIncreaseStake
Stakes the specified amount of AVT, locking its free usage in order to earn rewards.
**Note** This should only be used for _existing_ stakers - please query `getStakingStatus` to check first.\

**REQUEST**\
`POST https://AVN-API-URL/send`

**HEADERS**\
`Content-Type: application/json`\
`Authorization': bearer <awtToken>`

**REQUEST PARAMS**\
`relayer` *[required]* - a string representing the relayer's SS58 address \
`user` *[required]* - a string representing the user's SS58 address \
`amount` *[required]* - a string integer value representing the full amount of AVT to stake \
`proxySignature` *[required]* - a proof signed by the user allowing the transaction to be proxied \
`feePaymentSignature` *[required]* - a proof signed by the payer allowing the relayer fees to be paid \
`paymentNonce` *[required]* - string integer value of the current payment nonce of the payer

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/send \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"proxyIncreaseStake", "params":{"relayer":"5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", "user":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "amount":"0x899697fff9eccfb4de41ad689334751f28a7b5c026e9cf23c4e8ddecb11dcf35", "proxySignature":"0x4bd139e3ac19d8fe217574c138ca320a73041b15527ba220280117588ad3597c20788049b4fbb6df2d96e579af68d6643c1cd4234812f8c9adb0e102a5840145", "feePaymentSignature":"0x123ad5e9df7e5443b29de409e5668753aea836b97d73af3b491c018d11a1269ef091f712b27e75847f8e5d056a996b4186d0ee80b3eb05ef0d1991c05539b0c8", "paymentNonce":"305"}, "id":1}'
```

**RESULT FIELDS** \
`VALUE` - a request ID that can be queried for the transaction's status

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "80ada166-e4f7-441d-9f1d-1be266a2f89c"
}
```

#### proxyUnstakeAvt
Unstakes the specified amount of AVT, removing it from earning further staking rewards and (after a period) allowing it to be withdrawn back to the free balance

**REQUEST**\
`POST https://AVN-API-URL/send`

**HEADERS**\
`Content-Type: application/json`\
`Authorization': bearer <awtToken>`

**REQUEST PARAMS**\
`relayer` *[required]* - a string representing the relayer's SS58 address \
`user` *[required]* - a string representing the user's SS58 address \
`amount` *[required]* - a string integer value representing the full amount of AVT to unstake \
`proxySignature` *[required]* - a proof signed by the user allowing the transaction to be proxied \
`feePaymentSignature` *[required]* - a proof signed by the payer allowing the relayer fees to be paid \
`paymentNonce` *[required]* - string integer value of the current payment nonce of the payer

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/send \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"proxyUnstakeAvt", "params":{"relayer":"5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", "user":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "amount":"0x899697fff9eccfb4de41ad689334751f28a7b5c026e9cf23c4e8ddecb11dcf35", "proxySignature":"0x642e2bf73020f8bbdee84543fe696fd0fcfa0792702afd47b33dce5f0d986747dc75f255bc1e7881a90dd146ce0a1344316a5923deff2ee6b2ea867cdbfb2865", "feePaymentSignature":"0xbab9b458e835338e73b6d2ae1f33b1bcb34e3743f286c0adf9c49f23e0c9be1d5ae9e43a93ba1eb7af76f924e92e7693a6b4ab299299e02e6fc6388e89989bcf", "paymentNonce":"312"}, "id":1}'
```

**RESULT FIELDS** \
`VALUE` - a request ID that can be queried for the transaction's status

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "d52f3574-61b3-4bf6-b340-0d0ad05eee4b"
}
```

#### proxyWithdrawUnlocked
Withdraws previously unstaked AVT back to free balance

**REQUEST**\
`POST https://AVN-API-URL/send`

**HEADERS**\
`Content-Type: application/json`\
`Authorization': bearer <awtToken>`

**REQUEST PARAMS**\
`relayer` *[required]* - a string representing the relayer's SS58 address \
`user` *[required]* - a string representing the user's SS58 address \
`proxySignature` *[required]* - a proof signed by the user allowing the transaction to be proxied \
`feePaymentSignature` *[required]* - a proof signed by the payer allowing the relayer fees to be paid \
`paymentNonce` *[required]* - string integer value of the current payment nonce of the payer

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/send \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"proxyWithdrawUnlocked", "params":{"relayer":"5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", "user":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "proxySignature":"0x2d43738e47e395d2d1386f04b558c440f3806e13a5a64b1ceaa40360023b210aab69e9f3871d8410d63c42509ef047ffa7979fe697e53d39169c7a2a11917438", "feePaymentSignature":"0x7a1266bd213c15fbdfe4e399647f5d7b3d625b59cc0058252039009974da26b335ac5dc07973d2afb9a3062ccd6cd3b8caf915829820db50e1985b82c844c703", "paymentNonce":"339"}, "id":1}'
```

**RESULT FIELDS** \
`VALUE` - a request ID that can be queried for the transaction's status

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "7fd01739-2a52-4eba-941a-00497e7e0bf0"
}
```

#### proxyPayoutStakers
Triggers the payment of staking rewards to the next XXX stakers

**REQUEST**\
`POST https://AVN-API-URL/send`

**HEADERS**\
`Content-Type: application/json`\
`Authorization': bearer <awtToken>`

**REQUEST PARAMS**\
`relayer` *[required]* - a string representing the relayer's SS58 address \
`user` *[required]* - a string representing the user's SS58 address \
`era` *[required]* - a string integer value representing the era to payout \
`proxySignature` *[required]* - a proof signed by the user allowing the transaction to be proxied \
`feePaymentSignature` *[required]* - a proof signed by the payer allowing the relayer fees to be paid \
`paymentNonce` *[required]* - string integer value of the current payment nonce of the payer

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/send \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"proxyPayoutstakers", "params":{"relayer":"5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", "user":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "era":"1599", "proxySignature":"0x22ad3b01db96bf5b22d998a4296ff2d58180dc6eab357300b9613583f9570016fc5c439a80f17639e47ffb7100aa8cbea8def6ab2add7837ba0074321ed9c739", "feePaymentSignature":"0x6efb3277c7ee6f965bbf07d6a3faf2acb2fff71029ccd96f9c39b8ba3e2b27084420eae53fecc2bad956c90c5150df9bc3edbbddae5ef1dc538965b25f9efe41", "paymentNonce":"332"}, "id":1}'
```

**RESULT FIELDS** \
`VALUE` - a request ID that can be queried for the transaction's status

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "5e5f3346-9455-489e-b8dd-ee688046e97d"
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
    -d '{"jsonrpc":"2.0", "method":"requestState", "params":{"requestId":"410fe1c5-5deb-4a52-b89d-8bc9fc682415"}, "id":1}'
```

**RESULT FIELDS** \
`txHash` - string representing the transaction hash\
`blockNumber` - number representing the block number that contains this transaction\
`transactionIndex` - number representing the zero based index of this transaction in the block. The first transaction will have index 0. \
`status` - string detailing the current status:
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
  "result": {
    "txHash": "0x37b5aa64e1b56c2d250588ffe0c73d810783ef8ec60eaae1c773c0acbc63dc90",
    "status": "Processed",
    "blockNumber": 125412,
    "transactionIndex": 2}
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
