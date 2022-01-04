const AvnApi = require('../index.js')
const { accounts } = require('../config/accounts.json')

async function demoCbaAwt(gateway) {
    let sender = accounts.sender;

    let api = await avnApi(gateway)

    let iat = "2021-12-26T12:13:55+00:00";
    let payload = api.awt.generateAwtPayload(sender.mnemonic, iat);
    let myToken = await api.awt.generateAwtTokenFromPayload(payload);
    console.log('Payload: ', payload)
    console.log('Token %o', myToken);
}

// Copied here form helper because that file is not ready to run with arguments in different order
// I want to specify the network to connect to, without having to put it in position 6 as
// helper.js currently requires
async function avnApi(gateway) {
    console.log('Connecting to Gateway at: ', gateway);
    const api = new AvnApi(gateway)
    await api.init()
    return api
}

async function main() {
    let args = process.argv.slice(2);
    let configPath = args[0] ? `../config/${args[0]}.json` : '../config/sandbox.json'
    const { gateway } = require(configPath)

    demoCbaAwt(gateway);
}

( async () => {
    await main();
})().catch(err => {
    console.log(err)
});