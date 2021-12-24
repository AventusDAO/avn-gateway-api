const BN = require('bn.js')
const colors = require('colors');
const prompt = require('prompt-sync')()
const yargs = require('yargs')
const { accounts } = require('./demo-accounts.json')
const AvnApi = require('avn-api');
const { Keyring } = require('@polkadot/keyring');
const { create } = require('domain');
const keyring = new Keyring({ type: 'sr25519', ss58Format: 42 })

const dummyT1Authority = '0xd6ae8250b8348c94847280928c79fb3b63ca453e'

async function main() {
    const argv = yargs
    .strict()
    .string("config")
    .alias("config", "c")
    .demandOption("config")
    .describe("config", "Environment definitions")
    .argv

    let config = argv.config

    const CONFIG = require(config)
    console.log(`Connecting to ${CONFIG.gateway}`)
    let api = await avnApi(CONFIG.gateway)

    let totalAVT = new BN(await api.query.getTotalAvt())
    console.log('Total Chain AVT balance', totalAVT.toString())

    let SENDER = await initAccount(accounts.sender.mnemonic)
    let RELAYER = await initAccount(accounts.relayer.mnemonic)
    let RECEIVER = await initAccount(accounts.receiver.mnemonic)
    console.log(`Account balances`.bold)

    let senderBalance = new BN(await queryBalance(api, SENDER.address))
    let relayerBalance = new BN(await queryBalance(api, RELAYER.address))
    let receiverBalance = new BN(await queryBalance(api, RECEIVER.address))
    console.log(`[${SENDER.address}]: `.brightBlue + `${senderBalance}`)
    console.log(`[${RELAYER.address}]: `.brightBlue + `${relayerBalance}`)
    console.log(`[${RECEIVER.address}]: `.brightBlue + `${receiverBalance}`)

    // TODO: fix
    let txFee
    try {
        txFee = await api.query.getRelayerFees(RELAYER.address, SENDER.address)
    } catch (err) {
        console.log('Error obtaining fees', err)
        txFee = 'N/A'
    }
    console.log('Fees:', txFee)

    let amount = new BN(1000)
    try {
        const requestId = await api.send.transferAvt(RELAYER.address, RECEIVER.address, amount)
    } catch (err) {
        console.log('Error sending transferAVT transaction', err)
    }

    let newSenderBalance = new BN(await queryBalance(api, SENDER.address))
    let newRelayerBalance = new BN(await queryBalance(api, RELAYER.address))
    let newReceiverBalance = new BN(await queryBalance(api, RECEIVER.address))
    console.log(`[${SENDER.address}]: `.brightBlue + `${newSenderBalance}`)
    console.log(`[${RELAYER.address}]: `.brightBlue + `${newRelayerBalance}`)
    console.log(`[${RECEIVER.address}]: `.brightBlue + `${newReceiverBalance}`)

    let relayerGain = newRelayerBalance.sub(relayerBalance)
    let senderPaid = newSenderBalance.sub(senderBalance)
    let relayerFees = senderPaid.sub(amount)
    let networkFees = relayerFees.sub(relayerGain)
    let receiverGain = newReceiverBalance.sub(receiverBalance)


    console.log(`Receiver's gain: ${receiverGain}`.yellow.bold)
    console.log()
    console.log(`Sender's cost: ${senderPaid}`.bold)
    console.log(`= Amount sent: ${amount}`.yellow.bold)
    console.log(`+ Relayer fee: ${relayerFees}`.red)
    console.log()
    console.log(`Relayer gain : ${relayerGain}`.bold)
    console.log(`= Relayer fee: ${relayerFees}`)
    console.log(`- Network fee: ${networkFees}`.red)

    prompt('\n\nPress Enter for NFT Demo')

    let royalties = getRoyalties()
    let externalRef = createExternalRef()
    let nftId
    try {
        const requestId = await api.send.mintSingleNft(RELAYER.address, externalRef, royalties, dummyT1Authority)
        await helper.confirmStatus(api, requestId, 'Processed')
        nftId = await api.query.getNftId(externalRef)
        console.log(`Minted new NFT: ${nftId} with ref ${externalRef}`)
    } catch (err) {
        console.log('Error sending mint NFT transaction', err)
    }

    // Find the owner of the NFT in the AvN

    try {
        let requestId = await api.send.listFiatNftForSale(RELAYER.address, nftId)
        console.log(`Listed NFT for sale: ${nftId}`)
        prompt('...')
        requestId = await api.send.transferFiatNft(RELAYER.address, SENDER.address, nftId)
        console.log(`and transferred it to ${SENDER.address}`)
    } catch (err) {
        console.log('Error sending list NFT transaction', err)
    }

    // Find the owner

    try {
        let requestId = await api.send.listFiatNftForSale(RELAYER.address, nftId)
        console.log(`Re-Listed NFT for sale: ${nftId}`)
        prompt('...')
        requestId = await api.send.cancelFiatNftListing(relayer, nftId)
        requestId = await api.send.cancelFiatNftListing(RELAYER.address, RECIPIENT.address, nftId)
        console.log(`but cancelled the sale`)
    } catch (err) {
        console.log('Error sending list NFT transaction', err)
    }

}

function getRoyalties() {
    let royalties = []
    royaltyRecipient1 = '0xf8f77379A1C6b5CA66702b5943c5b229E310Ec03'
    royaltyRecipient2 = '0xE566A65705F2d8D6C1Da9063A29b6F0f1Ac1e6Da'
    royaltyRate1 = 10000
    royaltyRate2 = 20000

    return royalties
}

function createExternalRef() {
    return 'avn-gateway-test-' + new Date().toISOString() // This must be unique across all mints
}

async function avnApi(gateway) {
    const api = new AvnApi(gateway)
    await api.init()
    console.log(`Connected to Avn @ ${gateway}`)
    return api
}

async function initAccount(suri) {
    return keyring.addFromUri(suri)
}

async function queryBalance(api, address) {
    let balance = await api.query.getAvtBalance(address)
    return balance.toString()
}

(async () => {
    await main();
})().catch(e => {
    console.log(e);
    process.exit(1);
}
);


