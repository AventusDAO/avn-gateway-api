#!/bin/bash

if [ "$#" -eq 1 ]; then
    echo "[init-vault] Sourcing environment variables from $1"
    source $1
fi

set -e

echo "checking if vault has already been initialized"
initialized_vault=$(curl -s ${vault_api_url}/sys/health | jq .initialized)
if [ "$initialized_vault" = true ] ; then
    echo -e "[init-vault] \e[33mVault is already initialized. Skip step.\e[0m"
    exit
fi

if [ "$enable_auto_unseal" = true ] ; then
    echo "[init-vault] Initialising with auto-unseal enabled"
    shares_prefix="recovery"
    gpg_prefix="recovery_"
else
    echo "[init-vault] Initialising with Shamir seal"
    shares_prefix="secret"
    gpg_prefix=""
fi


# If GPG key is provided then encrypt keys root and unseal keys
if [[ -n "${gpg_key+x}" ]]; then
  echo "[init-vault] Found GPG key. Encrypting root and unseal keys with it"
  init_gpg_encryption_params='"'${gpg_prefix}'pgp_keys":["'${gpg_key}'"],"root_token_pgp_key":"'${gpg_key}'",'
else
  echo "[init-vault] No GPG key found. No encryption will be applied to root and unseal keys."
fi

echo "[init-vault] Prearing to create output folder here: <" $config_output ">"
config_output=$(readlink -f "$config_output")
echo "[init-vault] Creating folder" ${config_output}
mkdir -p ${config_output}
echo "Output folder created"

# TODO consider having more than one secret_shares
echo "[init-vault] * Sending initialising request to vault server"
echo $init_gpg_encryption_params
curl ${curl_args} --request POST --data '{
   '${init_gpg_encryption_params}'
   "'${shares_prefix}'_shares":1,
   "'${shares_prefix}'_threshold":1
}' ${vault_api_url}/sys/init > ${config_output}/init.json

if [ "$print_sensitive_data_to_output" = true ] ; then
    echo -e "[init-vault] \e[33m------------\e[0m"
    cat ${config_output}/init.json | jq
    echo -e "[init-vault] \e[33m------------\e[0m"
fi
