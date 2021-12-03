'use strict'

const { hexToU8a, isHex, u8aToHex } = require('@polkadot/util')
const { decodeAddress, encodeAddress } = require('@polkadot/util-crypto')
const { TypeRegistry, createTypeUnsafe } = require('@polkadot/types')
const { Keyring } = require('@polkadot/keyring')
const registry = new TypeRegistry()
const keyring = new Keyring({ type: 'sr25519' })
const { validate: uuidValidate } = require('uuid')
const BN = require('bn.js')

const TX_TYPE = {
  ProxyAvtTransfer: 'proxyAvtTransfer',
  ProxyTokenTransfer: 'proxyTokenTransfer',
  ProxyMintSingleNft: 'proxyMintSingleNft'
}

function convertToPublicKeyIfNeeded(accountAddressOrPublicKey) {
  if (isAccountPK(accountAddressOrPublicKey)) {
    return accountAddressOrPublicKey
  } else {
    try {
      const pk = keyring.decodeAddress(accountAddressOrPublicKey)
      return u8aToHex(pk)
    } catch (error) {
      const msg = 'Expected SS58 address (eg: "5FbUQ...") or hex public key (eg: "0x9c2bf..."), received:'
      console.error('Error -', msg, accountAddressOrPublicKey, error)
      return null
    }
  }
}

function isAccountPK(accountString) {
  return isHex(accountString) && accountString.slice(0, 2) === '0x' && accountString.slice(2).length === 64
}

function checkInputs(inputs) {
  Object.entries(inputs).forEach(([type, value]) => checkInput(type, value))
}

function checkInput(type, value) {
  let isValid

  switch (type) {
    case 'requestId':
      isValid = uuidValidate(value)
      break
    case 'account':
    case 'relayer':
    case 'user':
    case 'signer':
    case 'recipient':
      isValid = encodeAddress(isHex(value) ? hexToU8a(value) : decodeAddress(value))
      break
    case 'token':
    case 't1Authority':
      isValid = isHex(value) && value.split('').length == 42
      break
    case 'transactionType':
      isValid = Object.values(TX_TYPE).includes(value)
      break
    case 'externalRef':
      isValid = !(value ? value.replace(/\s/g, '').length == 0 : true)
      break
    case 'royalties':
      isValid = Array.isArray(value)
      break
    case 'amount':
      isValid = /^\d+$/.test(new BN(value).toString()) && !new BN(value).isZero()
      break
    default:
      throw new Error(`Unrecognised input type: "${type}"`)
  }

  if (!isValid) throw new Error(`Invalid ${type} value: ${value}`)
}

function obtainSignerSuri(_publicKey) {
  const publicKey = convertToPublicKeyIfNeeded(_publicKey)
  const suri = process.env[publicKey]
  if (!suri) throw new Error(`Please set environment variable "${publicKey}" to its seed`)
  return suri
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports = {
  checkInputs,
  convertToPublicKeyIfNeeded,
  obtainSignerSuri,
  keyring,
  registry,
  sleep,
  createTypeUnsafe,
  TX_TYPE
}
