#!/bin/bash

if [ "$#" -eq 1 ]; then
    echo "[init]  Sourcing environment variables from $1"
    source $1
fi

function cleanup {
    unset vault_root_token
    unset jsonData
}

trap cleanup EXIT

set -e
config_output=$(readlink -f "$config_output")

# vault setup
echo "[init]  * Registering avn-vault plugin"
SHA256=$(sha256sum ${avn_vault_path} | cut -d ' ' -f1)
plugin_registration_data=$(jq -n --arg s $SHA256 '{"command": "avn-vault", "sha256": $s}')
curl ${curl_args}\
    -H "X-Vault-Request: true" \
    -H "X-Vault-Token: $vault_root_token" \
    -X PUT \
    -d "$plugin_registration_data" \
    $vault_api_url/sys/plugins/catalog/secret/avn-vault


echo "[init]  * Enabling avn-vault plugin"
curl ${curl_args}\
    -H "X-Vault-Request: true" \
    -H "X-Vault-Token: $vault_root_token" \
    -X POST \
    -d '{"type": "plugin", "plugin_name": "avn-vault", "config": {"force_no_cache": true }}' \
    $vault_api_url/sys/mounts/avn-vault


echo "[init]  * Enabling vault approle auth method"
curl ${curl_args}\
    -H "X-Vault-Token: $vault_root_token" \
    -X POST \
    -d '{"type": "approle"}' \
    $vault_api_url/sys/auth/approle


echo "[init]  * Adding app policy"
app_policy=$(jq -Rs '{ "policy": . }' ./policies/app.hcl)
curl ${curl_args}\
    -H "X-Vault-Request: true" \
    -H "X-Vault-Token: $vault_root_token" \
    -H "Content-type: application/json" \
    -X POST \
    -d "$app_policy" \
    $vault_api_url/sys/policy/app


echo "[init]  * Creating 'avn-vault-app' approle"
curl ${curl_args}\
    -H "X-Vault-Request: true" \
    -H "X-Vault-Token: $vault_root_token" \
    -H "Content-type: application/json" \
    -X POST \
    -d '{"policies": ["app"]}' \
    $vault_api_url/auth/approle/role/avn-vault-app


echo "[init]  * Getting 'avn-vault-app' role_id"
app_role_id=$(curl ${curl_args}\
    -H "X-Vault-Request: true" \
    -H "X-Vault-Token: $vault_root_token" \
    -X GET \
    $vault_api_url/auth/approle/role/avn-vault-app/role-id | jq -r '.data.role_id')


echo "[init]  * Getting 'avn-vault-app' secret_id"
app_secret_id=$(curl ${curl_args}\
    -H "X-Vault-Request: true" \
    -H "X-Vault-Token: $vault_root_token" \
    -X POST \
    -d '{}' \
    $vault_api_url/auth/approle/role/avn-vault-app/secret-id | jq -r '.data.secret_id')

if [ "$create_authority" = true ] || [ "$create_relayer" = true ]
then
    echo "[init]  * Enabling vault userpass auth method"
    curl ${curl_args}\
        -H "X-Vault-Request: true" \
        -H "X-Vault-Token: $vault_root_token" \
        -H "Content-type: application/json" \
        -d '{"type": "userpass"}' \
        $vault_api_url/sys/auth/userpass
else
    echo -e "[init]  \e[33m* No authority or relayer found. Skipping enabling vault userpass auth method\e[0m"
fi


if [ "$create_authority" = true ]
then
    # Check if all authority variables are defined. If not stop.
    if [[ -z "${authority_username+x}" ]] || [[ -z "${authority_password+x}" ]] || [[ -z "${authority_mnemonic+x}" ]]
    then
        echo -e "[init]  \e[31m* About to create authority but missing one of [authority_username, authority_password, authority_mnemonic]. Stopping initialisation.\e[0m"
        exit -1
    fi

    echo "[init]  * Injecting user identity macro into authority policy path"
    userpass_accessor="$(curl ${curl_args} -H "X-Vault-Token: $vault_root_token" $vault_api_url/sys/auth | jq -r '.["userpass/"].accessor')"
    cat > ./policies/authority.hcl << EOF
path "avn-vault/authority/{{identity.entity.aliases.${userpass_accessor}.name}}/sign" {
capabilities = ["create", "update"]
}
EOF

    echo "[init]  * Adding authority policy"
    authority_policy=$(jq -Rs '{ "policy": . }' ./policies/authority.hcl)
    curl ${curl_args}\
        -H "X-Vault-Request: true" \
        -H "X-Vault-Token: $vault_root_token" \
        -H "Content-type: application/json" \
        -X POST \
        -d "$authority_policy" \
        $vault_api_url/sys/policy/authority

    echo "[init]  * Creating new vault user: '$authority_username'"
    authority_user_data=$(jq -n --arg t "userpass" --arg u $authority_username --arg p $authority_password --arg a "authority" '{"type": $t, "username": $u, "password": $p, "policies": $a}')
    curl ${curl_args}\
        -H "X-Vault-Request: true" \
        -H "X-Vault-Token: $vault_root_token" \
        -H "Content-type: application/json" \
        -X POST \
        -d "$authority_user_data" \
        $vault_api_url/auth/userpass/users/$authority_username
    authority_ecdsa_data=$(jq -n --arg n $authority_username --arg m "$authority_mnemonic" '{"name": $n, "mnemonic": $m}')
    echo "[init]  * Creating new avn-vault account for '$authority_username' from mnemonic"
    curl ${curl_args}\
        -H "X-Vault-Request: true" \
        -H "X-Vault-Token: $vault_root_token" \
        -H "Content-type: application/json" \
        -X POST \
        -d "$authority_ecdsa_data" \
        $vault_api_url/avn-vault/authority/$authority_username > /dev/null
else
    echo -e "[init]  \e[33m* No authority account found, skipping creation...\e[0m"
fi


if [ "$create_relayer" = true ]
then
    # Check if all relayer variables are defined. If not stop.
    if [[ -z "${relayer_username+x}" ]] || [[ -z "${relayer_password+x}" ]] || [[ -z "${relayer_seed+x}" ]]
    then
        echo -e "[init]  \e[31m* About to create authority but missing one of [relayer_username, relayer_password, relayer_seed]. Stopping initialisation.\e[0m"
        exit -1
    fi

echo "[init]  * Injecting user identity macro into relayer policy path"
userpass_accessor="$(curl ${curl_args} -H "X-Vault-Token: $vault_root_token" $vault_api_url/sys/auth | jq -r '.["userpass/"].accessor')"
cat > ./policies/relayer.hcl << EOF
path "avn-vault/relayer/{{identity.entity.aliases.${userpass_accessor}.name}}/sign" {
  capabilities = ["create", "update"]
}
EOF


echo "[init]  * Adding relayer policy"
relayer_policy=$(jq -Rs '{ "policy": . }' ./policies/relayer.hcl)
curl ${curl_args}\
    -H "X-Vault-Request: true" \
    -H "X-Vault-Token: $vault_root_token" \
    -H "Content-type: application/json" \
    -X POST \
    -d "$relayer_policy" \
    $vault_api_url/sys/policy/relayer

echo "[init]  * Creating new vault user: '$relayer_username'"
relayer_user_data=$(jq -n --arg t "userpass" --arg u $relayer_username --arg p $relayer_password --arg a "relayer" '{"type": $t, "username": $u, "password": $p, "policies": $a}')
curl ${curl_args}\
    -H "X-Vault-Request: true" \
    -H "X-Vault-Token: $vault_root_token" \
    -H "Content-type: application/json" \
    -X POST \
    -d "$relayer_user_data" \
    $vault_api_url/auth/userpass/users/$relayer_username


echo "[init]  * Creating new avn-vault account for '$relayer_username' from seed"
relayer_sr25519_data=$(jq -n --arg n $relayer_username --arg s "$relayer_seed" '{"name": $n, "seed": $s}')
curl ${curl_args}\
    -H "X-Vault-Request: true" \
    -H "X-Vault-Token: $vault_root_token" \
    -H "Content-type: application/json" \
    -X POST \
    -d "$relayer_sr25519_data" \
    $vault_api_url/avn-vault/relayer/$relayer_username > /dev/null
else
    echo -e "[init]  \e[33m* No relayer account found, skipping creation...\e[0m"
fi

# config output
echo "[init]  * writing json and yaml configs"
jq -n --arg u $vault_api_url/ --arg r $app_role_id --arg s $app_secret_id '{"vault_api_url": $u, "app_role_id": $r, "app_secret_id": $s}' > ${config_output}/config.json

cat > ${config_output}/config.yaml << EOF
vault_api_url: $vault_api_url/
app_role_id: $app_role_id
app_secret_id: $app_secret_id
EOF

# If defined add the authority username and password to config files
if [ "$create_authority" = true ]
then
    echo "authority_username: $authority_username" >> ${config_output}/config.yaml
    echo "authority_password: $authority_password" >> ${config_output}/config.yaml

    jsonData=$(cat ${config_output}/config.json)
    jq --arg au $authority_username --arg ap $authority_password '. += { "authority_username": $au, "authority_password": $ap }' <<<$jsonData > ${config_output}/config.json
fi

# If defined add the relayer username and password to config files
if [ "$create_relayer" = true ]
then
    echo "relayer_username: $relayer_username" >> ${config_output}/config.yaml
    echo "relayer_password: $relayer_password" >> ${config_output}/config.yaml
    jsonData=$(cat ${config_output}/config.json)
    jq --arg ru $relayer_username --arg rp $relayer_password '. += { "relayer_username": $ru, "relayer_password": $rp }' <<<$jsonData > ${config_output}/config.json
fi

if [ "$print_sensitive_data_to_output" = true ] ; then
    echo -e "[init] \e[33m------------\e[0m"
    cat ${config_output}/config.yaml
    echo -e "[init] \e[33m------------\e[0m"
fi

echo -e "[init] \e[31mYOU SHOULD REVOKE ROOT POWERS AFTER SETUP!\e[0m"
