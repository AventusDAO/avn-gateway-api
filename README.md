# avn-gateway-api

## JSON-RPC Methods

### avn_getTotalAvt
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
    -d '{"jsonrpc":"2.0","method":"avn_getTotalAvt","params": [],"id":1}'
```

**RESULT FIELDS**  
`TOTAL` - integer of the current total amount of circulating AVT in atto-AVT

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "0x2fe84e3113d7b"
}
```

### avn_getAvtBalance
Returns the AVT balance of a given AvN account

**REQUEST**  
`POST https://AVN-API-URL/YOUR-API-KEY`

**HEADERS**  
`Content-Type: application/json`

**REQUEST PARAMS**  
`ACCOUNT ID` *[required]* - a string representing the account ID (32 bytes) to check for AVT balance

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/YOUR-API-KEY \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"avn_getAvtBalance","params": ["0x46ebddef8cd9bb167dc30878d7113b7e168e6f0646beffd77d69d39bad76b47a"],"id":1}'
```

**RESULT FIELDS**  
`BALANCE` - integer of the current AVT balance in its smallest denomination

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "0x65a8db"
}
```

### avn_getTokenBalance
Returns the balance of a given token for a given AvN account

**REQUEST**  
`POST https://AVN-API-URL/YOUR-API-KEY`

**HEADERS**  
`Content-Type: application/json`

**REQUEST PARAMS**  
`TOKEN ID` *[required]* - a string representing the token ID (20 bytes) of the token being checked  
`ACCOUNT ID` *[required]* - a string representing the account ID (32 bytes) to check for token balance

**EXAMPLE**
```
## JSON-RPC over HTTPS POST
curl https://AVN-API-URL/YOUR-API-KEY \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"avn_getTokenBalance","params": ["0xc0ffee254729296a45a3885639AC7E10F9d54979", "0x46ebddef8cd9bb167dc30878d7113b7e168e6f0646beffd77d69d39bad76b47a"],"id":1}'
```

**RESULT FIELDS**  
`BALANCE` - integer of the current token balance in its smallest denomination

**BODY**
```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "0x7a28db03"
}
```