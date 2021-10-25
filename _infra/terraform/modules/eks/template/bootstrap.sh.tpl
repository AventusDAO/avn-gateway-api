#!/bin/bash
set -o xtrace
/etc/eks/bootstrap.sh ${cluster_name} --apiserver-endpoint "${cluster_endpoint}" --b64-cluster-ca "${cluster_auth_b64}"