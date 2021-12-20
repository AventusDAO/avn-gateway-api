path "auth/userpass/users/*" {
  capabilities = [ "create", "update", "read" ]
}

path "auth/approle/*" {
  capabilities = [ "create", "update" ]
}

path "avn-vault/*" {
  capabilities = [ "create", "update", "read" ]
}

path "avn-vault/authority/+/sign" {
  capabilities = [ "deny" ]
}

path "avn-vault/relayer/+/sign" {
  capabilities = [ "deny" ]
}