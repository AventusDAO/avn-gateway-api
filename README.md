[![avn-gateway](https://github.com/Aventus-Network-Services/avn-gateway-api/actions/workflows/lambdas.yml/badge.svg?branch=main)](https://github.com/Aventus-Network-Services/avn-gateway-api/actions/workflows/lambdas.yml)

[![avn-connector](https://github.com/Aventus-Network-Services/avn-gateway-api/actions/workflows/connector.yml/badge.svg?branch=main)](https://github.com/Aventus-Network-Services/avn-gateway-api/actions/workflows/connector.yml)

# avn-gateway-api

## AvN-API
Aventus AvN javascript API which connects to generic JSON-RPC spec.\
Please see the [avn-api](https://www.npmjs.com/package/avn-api) NPM module for JS functionality and example usage.

## Running
Before using the api, set the user's AvN mnemonic or secret seed as the **AVN_SURI** environment variable.\
Examples:
- `export AVN_SURI="industry icon train animal assist park sister wrong hammer cruise faint describe"`
- `export AVN_SURI=0x226beb8ff69a053e0f101944d4c917819f7b9e44f1d915f3cf30dc97844262e0`

**Note:** _It's important to keep the mnemonic/seed secret safe and not expose it anywhere else. If compromised you could lose all your funds._

#### Offline mode
Offline mode exposes the AWT token generation and signature proof generation required to configure JSON-RPC calls, along with account generation tools.\
To run the API in offline mode:
```
const AvnApi = require('avn-api');
const api = new AvnApi();
await api.init();
```
#### Online mode
Passing a gateway URL enables the full, connected api:
```
const AvnApi = require('avn-api');
const api = new AvnApi('https://sandbox.gateway.aventus.io');
await api.init();
```
The AVN_SURI environment variable may also be passed as an option:
```
const options = { suri: '0x226beb8ff69a053e0f101944d4c917819f7b9e44f1d915f3cf30dc97844262e0'}
const api = new AvnApi('https://sandbox.gateway.aventus.io', options);
```

### AWT tokens
AWT (Aventus Web Token) is an authorisation token that must be included in the header of every request sent to the gateway.\
The format for this header should be: `Authorization: bearer <awtToken>`.\
Tokens are generated and refreshed automatically by the api (lifetimes are 1 minute) but they can also be generated manually for JSON-RPC use:
```
const awtToken = api.awt.generateAwtToken();
```

### Proofs
Proofs are generated internally by the api but can also be constructed manually for JSON-RPC usage. \
Each transaction send request requires 2 types of proof:
1) a **proxySignature** confirming the transaction details. This is signed by the transaction originator (ie: the user)
2) a **feePaymentSignature** signed by either the user or any party willing to pay the relayer fee (ie: the payer)

#### Proxy Signature Generation
Ensure you suply the relevant transaction type and correct nonce.\
The api exposes the following methods:
  - `api.proxy.generateProxySignature('proxyAvtTransfer', { relayer, user, recipient, token, amount, nonce })`\
  _for the nonce call [getNonce](#getNonce) with `accountId` = user, `nonceType` = 'token'_

  - `api.proxy.generateProxySignature('proxyTokenTransfer', { relayer, user, recipient, token, amount, nonce })`\
  _for the nonce call [getNonce](#getNonce) with `accountId` = user, `nonceType` = 'token'_

  - `api.proxy.generateProxySignature('proxyConfirmTokenLift', { relayer, eventType, ethereumTransactionHash, nonce })`\
  _for the nonce call [getNonce](#getNonce) with `accountId` = user, `nonceType` = 'confirmation'_

  - `api.proxy.generateProxySignature('proxyTokenLower', { relayer, user, token, amount, t1Recipient, nonce })`\
  _for the nonce call [getNonce](#getNonce) with `accountId` = user, `nonceType` = 'token'_

  - `api.proxy.generateProxySignature('proxyMintSingleNft', { relayer, externalRef, royalties, t1Authority })`\
  _no nonce required_

  - `api.proxy.generateProxySignature('proxyListNftOpenForSale', { relayer, user, nftId, market, nonce })`\
  _for the nonce call [getNftNonce](#getNftNonce) with `nftId` = nftId_

  - `api.proxy.generateProxySignature('proxyTransferFiatNft', { relayer, nftId, recipient, nonce })`\
  _for the nonce call [getNftNonce](#getNftNonce) with `nftId` = nftId_

  - `api.proxy.generateProxySignature('proxyCancelListFiatNft', { relayer, nftId, nonce })`\
  _for the nonce call [getNftNonce](#getNftNonce) with `nftId` = nftId_

  - `api.proxy.generateProxySignature('proxyBond', { relayer, user, amount, nonce })`\
  _for the nonce call [getNonce](#getNonce) with `accountId` = user, `nonceType` = 'staking'_

  - `api.proxy.generateProxySignature('proxyNominate', { relayer, targets, nonce })`\
  _for the nonce call [getNonce](#getNonce) with `accountId` = user, `nonceType` = 'staking'_

  - `api.proxy.generateProxySignature('proxyIncreaseStake', { relayer, amount, nonce })`\
  _for the nonce call [getNonce](#getNonce) with `accountId` = user, `nonceType` = 'staking'_

  - `api.proxy.generateProxySignature('proxyUnstake', { relayer, amount, nonce })`\
  _for the nonce call [getNonce](#getNonce) with `accountId` = user, `nonceType` = 'staking'_

  - `api.proxy.generateProxySignature('proxyWithdrawUnlocked', { relayer, nonce })`\
  _for the nonce call [getNonce](#getNonce) with `accountId` = user, `nonceType` = 'staking'_

  - `api.proxy.generateProxySignature('proxyPayoutStakers', { relayer, era, nonce })`\
  _for the nonce call [getNonce](#getNonce) with `accountId` = user, `nonceType` = 'staking'_

#### Fee Payment Signature Generation
The fee payment signature is the same for all transactions, only the `transactionType` differs (this must match the proxy signature type)
  - `api.proxy.generateFeePaymentSignature({ relayer, user, proxySignature, relayerFee, paymentNonce })`\
  _for the nonce call [getNonce](#getNonce) with `accountId` = payer, `nonceType` = 'payment'_\
  _for the relayerFee call [getRelayerFees](#getRelayerFees) with `relayer` = relayer, `user` = payer, `transactionType` = eg: 'proxyTokenLower'_


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
`Authorization: bearer <awtToken>`

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
`Authorization: bearer <awtToken>`

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
`Authorization: bearer <awtToken>`

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
`Authorization: bearer <awtToken>`

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
`Authorization: bearer <awtToken>`

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
`Authorization: bearer <awtToken>`

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
`Authorization: bearer <awtToken>`

**REQUEST PARAMS** \
`accountId` *[required]* - a string representing the public key or SS58 address of the account to check for nonce\
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
`Authorization: bearer <awtToken>`

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
`Authorization: bearer <awtToken>`

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
`Authorization: bearer <awtToken>`

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
`VALUE` - a string representing the SS58 address of the current owner of the NFT

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
`Authorization: bearer <awtToken>`

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
Returns the staking status of the given AvN account. Existing stakers return 'isStaking', first time stakers return 'isNotStaking'.

**REQUEST** \
`POST https://AVN-API-URL/query`

**HEADERS** \
`Content-Type: application/json`
`Authorization: bearer <awtToken>`

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
`Authorization: bearer <awtToken>`

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
  "result": [
    "5DbvKeBMXrrMoTW3ZxKNn3GamjnDkmuMbR99VdDq217NxsUY",
    "5G4VXTJ29swHwEB6TPJDMKC1J1A5S9sVBMo67Ns6LaMrEP5d",
    "5EqF7WXH2Su8CiuXtDQv2Nt3GaVuzvPiMFoJoDesm8fZFND7",
    "5HB6wKaBYW95qqzWzZt6XNta6xFmVSDZuwuyzYwEpjENKPrE",
    "5GLVUNb9oKLesAjDt17X1N49xyp2fr62sKPAKLgmmNbDB9MH"
  ]
}
```

#### getActiveEra
Returns the current active era to call payoutStakers with

**REQUEST** \
`POST https://AVN-API-URL/query`

**HEADERS** \
`Content-Type: application/json`
`Authorization: bearer <awtToken>`

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

#### getEraElectionStatus
Returns the status of the era election. While an election is open, all staking activities are suspended.

**REQUEST** \
`POST https://AVN-API-URL/query`

**HEADERS** \
`Content-Type: application/json`
`Authorization: bearer <awtToken>`

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/query \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"getEraElectionStatus", "params":{}, "id":1}'
```

**RESULT FIELDS** \
`VALUE` - string detailing the era election status:
```
  'isOpen'
  'isClosed'
```
**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "isClosed"
}
```

#### getRelayerFees
Returns fees for a particular relayer, optionally by user and/or transaction type

**REQUEST** \
`POST https://AVN-API-URL/query`

**HEADERS** \
`Content-Type: application/json`
`Authorization: bearer <awtToken>`

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
    "proxyCancelListFiatNft": "7000000000000000",
    "proxyBond": "7000000000000000",
    "proxyNominate": "7000000000000000",
    "proxyIncreaseStake": "7000000000000000",
    "proxyUnstake": "7000000000000000",
    "proxyWithdrawUnlocked": "7000000000000000",
    "proxyPayoutStakers": "7000000000000000"
  }
}
```

#### getOwnedNfts
Returns an array of nft ids owned by the specified user

**REQUEST** \
`POST https://AVN-API-URL/query`

**HEADERS** \
`Content-Type: application/json`
`Authorization: bearer <awtToken>`

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

#### getStakingStats
Returns data related to the staking activities on the chain

**REQUEST** \
`POST https://AVN-API-URL/query`

**HEADERS** \
`Content-Type: application/json`
`Authorization: bearer <awtToken>`

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/query \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"getStakingStats", "params":{}, "id":1}'
```

**RESULT FIELDS** \
`totalStaked` - the total amount of AVT actively staked \
`minimumStaked` - the minimum amount staked by a staker \
`minUserBond` - the minimum amount of stake allowed by the chain for first time stakers. This restriction does not apply when topping up stake. \
`maxNominatorsRewardedPerValidator` - the maximum number of stakers that will be rewared per validator. \
`totalStakers` - the total number of stakers, excluding validators. \
`averageStaked` - the average stake, calculated as `totalStaked` divided by `total number of active stakers`


**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
   "result": {
     "totalStaked": "26421999999999999916890",
     "minimumStaked": "503999999999999995185",
     "minUserBond": "100000000000000000000",
     "maxNominatorsRewardedPerValidator": "256",
     "totalStakers": 10,
     "averageStaked": "5284399999999999983378"
   }
}
```

#### getCurrentBlock
Returns the most recent finalized block number

**REQUEST** \
`POST https://AVN-API-URL/query`

**HEADERS** \
`Content-Type: application/json`
`Authorization: bearer <awtToken>`

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/query \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"getCurrentBlock", "params":{}, "id":1}'
```

**RESULT FIELDS** \
`VALUE` - string integer value of the current block number

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "31357"
}
```

#### getChainInfo
Returns an object containing the chain name and version

**REQUEST** \
`POST https://AVN-API-URL/query`

**HEADERS** \
`Content-Type: application/json`
`Authorization: bearer <awtToken>`

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/query \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"getChainInfo", "params":{}, "id":1}'
```

**RESULT FIELDS** \
`name` - the name of the chain (eg: 'AvN MainNet', 'AvN Testnet')
`version` - string integer value detailing the current spec version

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "name": "AvN TestNet",
    "version": "270"
  }
}
```

#### getSummaryData
Returns the summary range (and ethereum transaction hash if the summary is published) which includes the passed block number.

**REQUEST** \
`POST https://AVN-API-URL/query`

**HEADERS** \
`Content-Type: application/json`
`Authorization: bearer <awtToken>`

**REQUEST PARAMS** \
`blockNumber` *[optional]* - a string representing the block number to check (if none is passed the current finalized block is used)

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/query \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"getSummaryRange", "params":{"blockNumber":"1234"}, "id":1}'
```

**RESULT FIELDS** \
`blockNumber` - the passed or current finalized block number
`range` - 2 element array with start and end block numbers of the summary (if the block falls within a summary range)
`ethTxHash` - Ethereum transaction hash of the published summary (if the summary root has been checked in by that point)

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "blockNumber": "1234",
    "summaryRange": ["0", "28800"],
    "ethTxHash": "0x32c40ef26710a2ed40d2b14ef9a92aab859cb35a92a279d6bc3fbb6fea84089f"
  }
}
```

#### getSummaryInclusionData
Returns the proof of a transaction's inclusion in a summary for which the root has been published on Ethereum tier1.\
The proof can be used to confirm any AvN tier2 transaction on tier1.\
The proof can also be used, in the case of a lower transaction, to complete the lowering process on tier1.\
The 2 required arguments are returned from [polling](#requestState) the state of a transaction.

**REQUEST** \
`POST https://AVN-API-URL/query`

**HEADERS** \
`Content-Type: application/json`
`Authorization: bearer <awtToken>`

**REQUEST PARAMS** \
`blockNumber` *[required]* - a string representing the block number containing the transaction
`transactionIndex` *[required]* - a string representing the index of the transaction within the block

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/query \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"getSummaryInclusionData", "params":{"blockNumber":"6042", "transactionIndex":"1"}, "id":1}'
```

**RESULT FIELDS** \
`inclusionProof:`
- `leaf` - the raw leaf (in combination with the merklePath) can be used to trigger a **lower** transaction operation on the Ethereum AVN contract
- `leafHash` - the leafHash (in combination with the merklePath) can be used to prove the transaction is included in a published root via the **confirmAvnTransaction** view method on the tier1 Ethereum AVN contract
- `merklePath` - the path in the format required by the Ethereum contract

`transactionDetails` - JSON blob containing the method/s and arguments of the original AvN transaction

**BODY**
```
{
  "inclusionProof": {
    "leaf": "0x590784009c2bfffc466eb9c1bad0d8393df93770468ee54b0a0f05232e4b5dde6960b004019a0fab268b26a5d77201ed704263dd7a14015d4ba4e712eab629d4712cfeaa4894545d39f4910f0947ebe6617c11764abd572b3364e257ea46e51dff12c8af81660100002d00270330ccad92fa31a27621c5fdf872c0244d92b0211662c5bce869d93edf79120f2e9c2bfffc466eb9c1bad0d8393df93770468ee54b0a0f05232e4b5dde6960b00401507fff4bc2f9f15e0281ed2a507bd7e86171800aaa58a82b8f7377b2b24dd12fbd33d7f69eb3e07e02b95ca303617334a0e7409e2f81751da5b89619ae32e58e30ccad92fa31a27621c5fdf872c0244d92b0211662c5bce869d93edf79120f2e405df1b38510c455ef81500a3dc7e9ae599e18f617000000000000000000000000000000de7e1091cde63c05aa4d82c62e4c54edbc701b220130ccad92fa31a27621c5fdf872c0244d92b0211662c5bce869d93edf79120f2e9c2bfffc466eb9c1bad0d8393df93770468ee54b0a0f05232e4b5dde6960b00400806d8176de18000000000000000000016865221a7b2234cbe5fffc25c4423bcb60497e291ddf940f295c07a2217aa03a411c1d1d9e52cd7a79b3f95203eff6304fe45658a54e82d5b9ed7eaebfb56986",
    "leafHash": "0xe3479fd158fddcf61715bcaf892cfe64ca0b09370cbba817944e13402adbc285",
    "merklePath": "[0x4fc3651d601f947edf0f77d85c728726a4f7865ca5d41cb58c171cb918770c24,0x9794215960d349ee3a90ca3d55183dcf46f32c79a95764097e6c3a776ed5e614,0x4bf740636dd543b4ce9e124c724b49a2f5fca8ff67ba795630c6724dd0d87a62,0xf7f7ba083defa6697a117f3cc1f3ab713329fd8054f0decffb3b33d4b5f24b54,0x31a652bd6015b63d779f8afd375e9681c9189ec2a12e4ffda56a1e07e258fdad,0x13a155b5b822668921f415a8ddd861b8833c9de74e84fe6b52f3ab495d34bef6,0x3a5f81321f1798d96545ded22bec16940d49b293124d88abf3aaf507856e1e9a,0xce5503d5f43a3de45f5c10beafc4e70906a1bb67ead41f6bd48875459193e121,0x40acb9081bf0b1988fa54ab3d1ef2e8ef4400a51cab8657a9cfcbc111967a671,0x50092cca094736c95fa812183c0bd5f1d1d3df38d266416e5670ef2be26581ab,0x5ff75b66fbcde510aa88f80fae41ce6175bb2a149eff17e767ffd06e2ee6ed05,0x38bd0db26065aa241ab920ab427bb1580dfbb05838c52d81fa92cdec9ecc8a9a,0x353fcbb419b9cce1c3a025ad7c8e57ce993c729a6626e29d3df344ca55a02177,0x5da597c90971d36417f7f7d49f48f6850346c7df300dd5a82fc1f55efe40c3fc,0x0c808a1db253e9f140a02762bd7ebb6d5490ebcb41af0db144338ccd2700bdb9,0x5ad4b6d0de546f84d8d191484cbb47fd156cef315839678a1eefdf3800d1c821]"
  },
  "transactionDetails": {
    "args": [
      {
        "args": [
          {
            "signer": "5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr",
            "relayer": "5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh",
            "signature": {
              "Sr25519": "0x507fff4bc2f9f15e0281ed2a507bd7e86171800aaa58a82b8f7377b2b24dd12fbd33d7f69eb3e07e02b95ca303617334a0e7409e2f81751da5b89619ae32e58e"
            }
          },
          "5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr",
          "0x405df1b38510c455ef81500a3dc7e9ae599e18f6",
          "23",
          "0xde7e1091cde63c05aa4d82c62e4c54edbc701b22"
        ],
        "method": "signedLower",
        "section": "tokenManager"
      },
      {
        "payer": "5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr",
        "recipient": "5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh",
        "amount": "7.0000 mAVT",
        "signature": {
          "Sr25519": "0x6865221a7b2234cbe5fffc25c4423bcb60497e291ddf940f295c07a2217aa03a411c1d1d9e52cd7a79b3f95203eff6304fe45658a54e82d5b9ed7eaebfb56986"
        }
      }
    ],
    "method": "proxy",
    "section": "avnProxy"
  }
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
`Authorization: bearer <awtToken>`

**REQUEST PARAMS** \
`relayer` *[required]* - a string representing the relayer's SS58 address \
`user` *[required]* - a string representing the user's SS58 address \
`payer` *[required]* - a string representing the payer's SS58 address \
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
    -d '{"jsonrpc":"2.0", "method":"proxyAvtTransfer", "params":{"relayer":"5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", "user":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "payer":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "recipient":"5FgyNN84CzQfwHBUJWvQkr36hiQYEXjDhcUYVx9tCTdgqosF", "token":"0x405df1b38510c455ef81500a3dc7e9ae599e18f6", "amount":"20000", "proxySignature":"0xc2f5deeede54698bffd1779532cf66590ff5302ea624b5d3b8e72d5a949e90027eed2a19f2a12161c293204dbb1ccc4032e4248760f6385a83d5e44188cf9d8b", "feePaymentSignature":"0xde49e7ab095debda05f86a122d064d24bc9c31360d1e5ebc1357076918ca78465a5428f77507f966531e29eee43070611d07f5a1632c11ff1741c3c12b22db83", "paymentNonce":"200"}, "id":1}'
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
`Authorization: bearer <awtToken>`

**REQUEST PARAMS**\
`relayer` *[required]* - a string representing the relayer's SS58 address \
`user` *[required]* - a string representing the user's SS58 address \
`payer` *[required]* - a string representing the payer's SS58 address \
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
    -d '{"jsonrpc":"2.0", "method":"proxyTokenTransfer", "params":{"relayer":"5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", "user":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "payer":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "recipient":"5FgyNN84CzQfwHBUJWvQkr36hiQYEXjDhcUYVx9tCTdgqosF", token":"0xb130395ae89acbe32999f8eb6e6114a56d676199", "amount":"1000000", "proxySignature":"0x883e4300581dcaf3373c81eff1ec86776c58aa12fd184d4500d1aab8b7832076484d967ca01c96e7ab6d20903145c9efebac38ed521f30fe52da2e27beecf08f", "feePaymentSignature":"0x7cff997be6fb98db949da0eceee2480b46a3b3aeaf4dbc7862bf6617a4c23319f666dfc2bb9e9a365ffd67ab279d980a0139fa6ce0165cdd76aaf555e7a1ba80", "paymentNonce":"199"}, "id":1}'
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
`Authorization: bearer <awtToken>`

**REQUEST PARAMS**\
`relayer` *[required]* - a string representing the relayer's SS58 address \
`user` *[required]* - a string representing the user's SS58 address \
`payer` *[required]* - a string representing the payer's SS58 address \
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
    -d '{"jsonrpc":"2.0", "method":"proxyConfirmTokenLift", "params":{"relayer":"5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", "user":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "payer":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "eventType": 1, "ethereumTransactionHash": "0xad7190f148fbd57b2a615c964b3ad2dcf17574ebf0d1c9778f6aab09657814ca", "proxySignature":"0x362f3e1f9f8f8802b84a54562be6ae1451a959b84b037f98604d9fa78d4f9ab068d6385baeaa16cd3a060829d5f776444af59d07c0755483acca220007422319", "feePaymentSignature":"0x5f3f0ca4ed32b4172998f816cf5e296553b29ec042a7b564c493568d3cf89687f08b9b48b17ca84f1935e8d844a9f133a239df12d7fa3d0fda58bb9a9d65eb10", "paymentNonce":"314"}, "id":1}'
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
`Authorization: bearer <awtToken>`

**REQUEST PARAMS**\
`relayer` *[required]* - a string representing the relayer's SS58 address \
`user` *[required]* - a string representing the user's SS58 address \
`payer` *[required]* - a string representing the payer's SS58 address \
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
    -d '{"jsonrpc":"2.0", "method":"proxyTokenLower", "params":{"relayer":"5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", "user":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "payer":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "t1Recipient":"0xFad45995bc1ceE164E7565e301F5736F3eed3Bb1", "token":"0x405df1b38510c455ef81500a3dc7e9ae599e18f6", "amount":"3", "proxySignature":"0x8e38f2809d58c2a75cd0529ebb650e4447c3b192e6b9eb4a7ae346049b1e18552565e94981e3bece4bf71667b88e54c39340aa931872f1f332ab72b94cb9938c", "feePaymentSignature":"0x9ae648e3c25ba12ae2272024ad7b0ed954e2f8057c544b825f800e886b7a79213f24c884f9aac6d2cd5d0a7bff6a813140ee20e38e7374c054d31d0834250684", "paymentNonce":"10"}, "id":1}'
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
`Authorization: bearer <awtToken>`

**REQUEST PARAMS**\
`relayer` *[required]* - a string representing the relayer's SS58 address \
`user` *[required]* - a string representing the user's SS58 address \
`payer` *[required]* - a string representing the payer's SS58 address \
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
    -d '{"jsonrpc":"2.0", "method":"proxyMintSingleNft", "params":{"relayer":"5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", "user":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "payer":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "externalRef":"my-unique-ref-2022-01-18T10:32:45.199Z", "royalties": [{"recipient_t1_address":"0xf8f77379A1C6b5CA66702b5943c5b229E310Ec03", "rate": {"parts_per_million":"10000"}}], "t1Authority":"0xd6ae8250b8348c94847280928c79fb3b63ca453e", "proxySignature":"0xd4d20c5be0943cd1e784b7d83f7bf69d1c2419411c1b6b6d60c1e6d2c636742c30f44100d0fe24717104cad467890272d47a36f8daf497ebd2ec3ed106c58d8f", "feePaymentSignature":"0x4e4ec2190d44765d1b5fa88f6aabbf87744ef964c171f0ec48763fcfbc99e47e9b0ccd633403f75068604cf3b94336c7e93a56b13a0973d181432d381b5b0f8a", "paymentNonce":"201"}, "id":1}'
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
`Authorization: bearer <awtToken>`

**REQUEST PARAMS**\
`relayer` *[required]* - a string representing the relayer's SS58 address \
`user` *[required]* - a string representing the user's SS58 address \
`payer` *[required]* - a string representing the payer's SS58 address \
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
    -d '{"jsonrpc":"2.0", "method":"proxyListNftOpenForSale", "params":{"relayer":"5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", "user":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "payer":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "nftId":"0x2c94a703a7b01f0c2d1eed5ccf82b9cbadd0bdd5e4e5283ddf01b249586181c2", "market": 2, "proxySignature":"0xc695f01932ce42204d9a0102e74d32d3d43f4ac6a9d615647aec29f68c707e42dc372d29fbb2d0d303d4b5d184fbe294ce5e06c93d9771a56cfe7533e0cdb488", "feePaymentSignature":"0x02529e00606006ef98d70e8c32cd6a495faf362767366d01060a4fe43c1c5410f4c5260dde125da581b772909b5ed2756b83c71a5ef6568a36a79ab565cd158e", "paymentNonce":"205"}, "id":1}'
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
`Authorization: bearer <awtToken>`

**REQUEST PARAMS**\
`relayer` *[required]* - a string representing the relayer's SS58 address \
`user` *[required]* - a string representing the user's SS58 address \
`payer` *[required]* - a string representing the payer's SS58 address \
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
    -d '{"jsonrpc":"2.0", "method":"proxyTransferFiatNft", "params":{"relayer":"5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", "user":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "payer":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "nftId":"0x3044598a96da039d27802b300ba6197d6a023752efaccf598e62516f6ee7587c", "recipient":"5FgyNN84CzQfwHBUJWvQkr36hiQYEXjDhcUYVx9tCTdgqosF", "proxySignature":"0xaa3b454549de3a941e19293c0da9e47e83b920df232d5db56d5912f83b1e0c43083b1103f9655c52290221bf590facd9e99a839cafc383c30567055a56c97c8a", "feePaymentSignature":"0x500da1ab75346f2b4459cc2b958a3eb690a4b8c50cc1e6f3d49fe786cb6acd0be0ca93da71bbe55d11f8df8f64f3b99c2c47a053495bf6eb842ecc4fbfad6b87", "paymentNonce":"212"}, "id":1}'
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
`Authorization: bearer <awtToken>`

**REQUEST PARAMS**\
`relayer` *[required]* - a string representing the relayer's SS58 address \
`user` *[required]* - a string representing the user's SS58 address \
`payer` *[required]* - a string representing the payer's SS58 address \
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
    -d '{"jsonrpc":"2.0", "method":"proxyCancelListFiatNft", "params":{"relayer":"5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", "user":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "payer":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "nftId":"0x899697fff9eccfb4de41ad689334751f28a7b5c026e9cf23c4e8ddecb11dcf35", "proxySignature":"0x7e8fb895d9c33fbfd2b0122a586d2d29a6c606ee2ca485c8eb69163be8ef7a6ddd2a52e6802f40720e192d4ca407d657cdfa703a8ce502e9c4f0feedfc3e5e8b", "feePaymentSignature":"0xaae7983775fc1a5bc04b500af156dcba343f1d305549737821b7e31a12f6ce430941856c1259d520759548281afd465b3d66b7e48e72fc2c8c0a3a5bb9f8fa87", "paymentNonce":"209"}, "id":1}'
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
_**Note** This should only be used for first time stakers - please query [getStakingStatus](#getStakingStatus) to check first._\
_**Note-2** The initial staking requires two, ordered sets of proofs; one to cover the bonding step and one to cover the nominating step._

**REQUEST**\
`POST https://AVN-API-URL/send`

**HEADERS**\
`Content-Type: application/json`\
`Authorization: bearer <awtToken>`

**REQUEST PARAMS**\
`relayer` *[required]* - a string representing the relayer's SS58 address \
`user` *[required]* - a string representing the user's SS58 address \
`payer` *[required]* - a string representing the payer's SS58 address \
`amount` *[required]* - a string integer value representing the full amount of AVT to stake \
`targets` *[required]* - The list of validators to nominate \
`bondMethodName` *[required]* - Method name must be 'proxyBond' \
`proxyBondSignature` *[required]* - a proof signed by the user allowing the bond transaction to be proxied \
`bondFeePaymentSignature` *[required]* - a proof signed by the user allowing the bond relayer fees to be paid \
`bondPaymentNonce` *[required]* - string integer value of the payment nonce used in the bondFeePaymentSignature \
`nominateMethodName` *[required]* - Method name must be 'proxyNominate' \
`proxyNominateSignature` *[required]* - a proof signed by the user allowing the nominate transaction to be proxied \
`nominateFeePaymentSignature` *[required]* - a proof signed by the user allowing the nominate relayer fees to be paid \
`nominatePaymentNonce` *[required]* - string integer value of the payment nonce used in the nominateFeePaymentSignature \
_**Note**: nominatePaymentNonce must succeed bondPaymentNonce_

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/send \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: bearer <awtToken>" \
    -d '{"jsonrpc":"2.0", "method":"proxyStakeAvt", "params":{ "relayer":"5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", user":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "payer":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "amount":"100000000000000000000", "targets": ["5DbvKeBMXrrMoTW3ZxKNn3GamjnDkmuMbR99VdDq217NxsUY", "5G4VXTJ29swHwEB6TPJDMKC1J1A5S9sVBMo67Ns6LaMrEP5d", "5EqF7WXH2Su8CiuXtDQv2Nt3GaVuzvPiMFoJoDesm8fZFND7", "5HB6wKaBYW95qqzWzZt6XNta6xFmVSDZuwuyzYwEpjENKPrE", "5GLVUNb9oKLesAjDt17X1N49xyp2fr62sKPAKLgmmNbDB9MH"], "bondMethodName":"proxyBond", "proxyBondSignature":"0x2acfc3b9c07ae35bdb919a4c262477f7c6f4aa2d34e2d7f7178570f4bb5d587f38d79c683de78ddb6f3a9795fb897c32f7fb9c498cfd0c17b378d231ab2ecf88", "bondFeePaymentSignature":"0x1ef967691f403d0b8c5f26867316fdcabbd9a42ba8dbc8f78b2fb188a777536d3299e707732180c242237eee077db5988de91619c9f44ceda0eb8347cc02ea81", "bondPaymentNonce":"732", "nominateMethodName":"proxyNominate", "proxyNominateSignature":"0x02c90f2c8ca1f5a088548f257167784f4590a1e8d5b8d65bd15e6df60027b7799a6d3e2375ce196f3ec42ae4ab935065907a1b7f0b50e64fcd6523ce48ae7f80", "nominateFeePaymentSignature":"0x6a8865456f4ea17e18097141db18bb2f423c750ffe9d04fa08e5b57f6ce11e6813e0c15e9e6340f5f82f17423919616242d294a3e1b8f7182000a502aa756682", "nominatePaymentNonce":"733"}, "id":1}'
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

**VALIDATION** \
This endpoint can only be called while the `eraElectionWindow` is closed. If it is called during an election, the following error response will be returned:

```
{
  "code":-32600,
  "message":"Invalid Request",
  "data": {
      "gatewayError":"election window is open",
      "request":"{...}"
}
```

#### proxyIncreaseStake
Stakes the specified amount of AVT, locking its free usage in order to earn rewards.\
_**Note** This should only be used for existing stakers - please query [getStakingStatus](#getStakingStatus) to check first._

**REQUEST**\
`POST https://AVN-API-URL/send`

**HEADERS**\
`Content-Type: application/json`\
`Authorization: bearer <awtToken>`

**REQUEST PARAMS**\
`relayer` *[required]* - a string representing the relayer's SS58 address \
`user` *[required]* - a string representing the user's SS58 address \
`payer` *[required]* - a string representing the payer's SS58 address \
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
    -d '{"jsonrpc":"2.0", "method":"proxyIncreaseStake", "params":{"relayer":"5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", "user":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "payer":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "amount":"0x899697fff9eccfb4de41ad689334751f28a7b5c026e9cf23c4e8ddecb11dcf35", "proxySignature":"0x4bd139e3ac19d8fe217574c138ca320a73041b15527ba220280117588ad3597c20788049b4fbb6df2d96e579af68d6643c1cd4234812f8c9adb0e102a5840145", "feePaymentSignature":"0x123ad5e9df7e5443b29de409e5668753aea836b97d73af3b491c018d11a1269ef091f712b27e75847f8e5d056a996b4186d0ee80b3eb05ef0d1991c05539b0c8", "paymentNonce":"305"}, "id":1}'
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
**VALIDATION** \
This endpoint can only be called while the `eraElectionWindow` is closed. If it is called during an election, the following error response will be returned:

```
{
  "code":-32600,
  "message":"Invalid Request",
  "data": {
      "gatewayError":"election window is open",
      "request":"{...}"
}
```

#### proxyUnstakeAvt
Unstakes the specified amount of AVT, removing it from earning further staking rewards and (after a period) allowing it to be withdrawn back to the free balance

**REQUEST**\
`POST https://AVN-API-URL/send`

**HEADERS**\
`Content-Type: application/json`\
`Authorization: bearer <awtToken>`

**REQUEST PARAMS**\
`relayer` *[required]* - a string representing the relayer's SS58 address \
`user` *[required]* - a string representing the user's SS58 address \
`payer` *[required]* - a string representing the payer's SS58 address \
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
    -d '{"jsonrpc":"2.0", "method":"proxyUnstakeAvt", "params":{"relayer":"5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", "user":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "payer":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "amount":"1000000000000000000", "proxySignature":"0x58fb48fdc865c557d9b6135f4f868090e9be76b07a9cf44b65e1e4ec1a6248167bcffbdbeaa9f1eb9b03d6aea0260ea6a941b0b168f9a1e3729ee3a4e94e8088", "feePaymentSignature":"0x5a1538a4931d310ad948db3553e027026bc7e1f4e73feb1497620458f69b906aaaea6632810f4c1cd25a81218463a5550efa53229f8b4e033aaf476a5e72c881", "paymentNonce": "779"}, "id":1}'
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

**VALIDATION** \
This endpoint can only be called while the `eraElectionWindow` is closed. If it is called during an election, the following error response will be returned:

```
{
  "code":-32600,
  "message":"Invalid Request",
  "data": {
      "gatewayError":"election window is open",
      "request":"{...}"
}
```

#### proxyWithdrawUnlocked
Withdraws previously unstaked AVT back to free balance

**REQUEST**\
`POST https://AVN-API-URL/send`

**HEADERS**\
`Content-Type: application/json`\
`Authorization: bearer <awtToken>`

**REQUEST PARAMS**\
`relayer` *[required]* - a string representing the relayer's SS58 address \
`user` *[required]* - a string representing the user's SS58 address \
`payer` *[required]* - a string representing the payer's SS58 address \
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
    -d '{"jsonrpc":"2.0", "method":"proxyWithdrawUnlocked", "params":{"relayer":"5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", "user":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "payer":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "proxySignature":"0x2d43738e47e395d2d1386f04b558c440f3806e13a5a64b1ceaa40360023b210aab69e9f3871d8410d63c42509ef047ffa7979fe697e53d39169c7a2a11917438", "feePaymentSignature":"0x7a1266bd213c15fbdfe4e399647f5d7b3d625b59cc0058252039009974da26b335ac5dc07973d2afb9a3062ccd6cd3b8caf915829820db50e1985b82c844c703", "paymentNonce":"339"}, "id":1}'
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

**VALIDATION** \
This endpoint can only be called while the `eraElectionWindow` is closed. If it is called during an election, the following error response will be returned:

```
{
  "code":-32600,
  "message":"Invalid Request",
  "data": {
      "gatewayError":"election window is open",
      "request":"{...}"
}
```

#### proxyPayoutStakers
Triggers the payment of staking rewards to the next XXX stakers

**REQUEST**\
`POST https://AVN-API-URL/send`

**HEADERS**\
`Content-Type: application/json`\
`Authorization: bearer <awtToken>`

**REQUEST PARAMS**\
`relayer` *[required]* - a string representing the relayer's SS58 address \
`user` *[required]* - a string representing the user's SS58 address \
`payer` *[required]* - a string representing the payer's SS58 address \
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
    -d '{"jsonrpc":"2.0", "method":"proxyPayoutstakers", "params":{"relayer":"5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh", "user":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "payer":"5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "era":"1599", "proxySignature":"0x22ad3b01db96bf5b22d998a4296ff2d58180dc6eab357300b9613583f9570016fc5c439a80f17639e47ffb7100aa8cbea8def6ab2add7837ba0074321ed9c739", "feePaymentSignature":"0x6efb3277c7ee6f965bbf07d6a3faf2acb2fff71029ccd96f9c39b8ba3e2b27084420eae53fecc2bad956c90c5150df9bc3edbbddae5ef1dc538965b25f9efe41", "paymentNonce":"332"}, "id":1}'
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

**VALIDATION** \
This endpoint can only be called while the `eraElectionWindow` is closed. If it is called during an election, the following error response will be returned:

```
{
  "code":-32600,
  "message":"Invalid Request",
  "data": {
      "gatewayError":"election window is open",
      "request":"{...}"
}
```

### Polling

#### requestState
Gets the current state of a previously sent asynchronous transaction request

**REQUEST** \
`POST https://AVN-API-URL/poll`

**HEADERS** \
`Content-Type: application/json`
`Authorization: bearer <awtToken>`

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
`status` - string detailing the current status:
```
  'Pending'
  'Rejected'
  'Processed'
  'Transaction not found'
```
`blockNumber` *[if status is 'Processed' or 'Rejected']* - string integer representing the block number containing this transaction\
`transactionIndex` *[if status is 'Processed' or 'Rejected']* - string integer representing the (zero-based) index of this transaction in the block.\

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "txHash": "0x37b5aa64e1b56c2d250588ffe0c73d810783ef8ec60eaae1c773c0acbc63dc90",
    "status": "Processed",
    "blockNumber": "125412",
    "transactionIndex": "2"
  }
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
