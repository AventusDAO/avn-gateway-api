# avn-gateway-api

## JSON-RPC Methods

### getTotalAvt
Returns the total amount of AVT in the AvN

**REQUEST**  
`POST https://AVN-API-URL/YOUR-API-KEY`  

**HEADERS**  
`Content-Type: application/json`  

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/YOUR-API-KEY \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"getTotalAvt","params": [],"id":1}'
```

**RESULT FIELDS**  
`TOTAL` - string integer value of the current total amount of circulating AVT in its smallest denomination

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "150000000000000000000"
}
```

### getAvtBalance
Returns the AVT balance of a given AvN account

**REQUEST**  
`POST https://AVN-API-URL/YOUR-API-KEY`

**HEADERS**  
`Content-Type: application/json`

**REQUEST PARAMS**  
`ACCOUNT ID / SS58 ADDRESS` *[required]* - a string representing the account ID (32 bytes) or SS58 address to check for AVT balance

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/YOUR-API-KEY \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"getAvtBalance","params": ["0x46ebddef8cd9bb167dc30878d7113b7e168e6f0646beffd77d69d39bad76b47a"],"id":2}'
```

**RESULT FIELDS**  
`BALANCE` - string integer value of the current AVT balance in its smallest denomination

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": "3000000000000000000"
}
```

### getTokenBalance
Returns the balance of a given token for a given AvN account

**REQUEST**  
`POST https://AVN-API-URL/YOUR-API-KEY`

**HEADERS**  
`Content-Type: application/json`

**REQUEST PARAMS**  
`TOKEN ID` *[required]* - a string representing the token ID (20 bytes) of the token being checked  
`ACCOUNT ID / SS58 ADDRESS` *[required]* - a string representing the account ID (32 bytes) or SS58 address to check for token balance

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/YOUR-API-KEY \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"getTokenBalance","params": ["0xc0ffee254729296a45a3885639AC7E10F9d54979", "5Gv8YYFu8H1btvmrJy9FjjAWfb99wrhV3uhPFoNEr918utyR"],"id":3}'
```

**RESULT FIELDS**  
`BALANCE` - string integer value of the current token balance in its smallest denomination

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": "5000000000000000000"
}
```