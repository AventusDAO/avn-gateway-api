# avn-gateway-api

## JSON-RPC Methods

### getTotalAvt
Returns the total amount of AVT in the AvN

**REQUEST**  
`POST https://AVN-API-URL/query`  

**HEADERS**  
`Content-Type: application/json`  

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/query \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0", "method":"getTotalAvt", "params":[], "id":1}'
```

**RESULT FIELDS**  
`TOTAL` - string integer value of the current total amount of circulating AVT in its smallest denomination

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "5100000000000000000000"
}
```

### getAvtBalance
Returns the AVT balance of a given AvN account

**REQUEST**  
`POST https://AVN-API-URL/query`

**HEADERS**  
`Content-Type: application/json`

**REQUEST PARAMS**  
`ACCOUNT ID / SS58 ADDRESS` *[required]* - a string representing the account ID (32 bytes) or SS58 address to check for AVT balance

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/query \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0", "method":"getAvtBalance", "params":["5GLVUNb9oKLesAjDt17X1N49xyp2fr62sKPAKLgmmNbDB9MH"], "id":2}'
```

**RESULT FIELDS**  
`BALANCE` - string integer value of the current AVT balance in its smallest denomination

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": "930009105441170202155"
}
```

### getTokenBalance
Returns the balance of a given token for a given AvN account

**REQUEST**  
`POST https://AVN-API-URL/query`

**HEADERS**  
`Content-Type: application/json`

**REQUEST PARAMS**  
`ACCOUNT ID / SS58 ADDRESS` *[required]* - a string representing the account ID (32 bytes) or SS58 address to check for token balance
`TOKEN ID` *[required]* - a string representing the token ID (20 bytes) of the token being checked  

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/query \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0", "method":"getTokenBalance", "params":["5DAgxVxKmnJ7hfhDEB9UetZm4jR2MPjGZGrmJZjirSVJDdMr", "0x2adce7ada36d86253aa63bcf4aad9f84ccb9480e"], "id":3}'
```

**RESULT FIELDS**  
`BALANCE` - string integer value of the current token balance in its smallest denomination

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": "30"
}
```

### getAccountNonce
Returns the nonce of a given AvN account

**REQUEST**  
`POST https://AVN-API-URL/query`

**HEADERS**  
`Content-Type: application/json`

**REQUEST PARAMS**  
`ACCOUNT ID / SS58 ADDRESS` *[required]* - a string representing the account ID (32 bytes) or SS58 address to check for nonce

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/query \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0", "method":"getAccountNonce", "params":["5GLVUNb9oKLesAjDt17X1N49xyp2fr62sKPAKLgmmNbDB9MH"], "id":4}'
```

**RESULT FIELDS**  
`BALANCE` - string integer value of the current account nonce

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": "3"
}
```