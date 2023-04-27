const AvnApi = require('../index.js');

const GATEWAY_URL = 'https://uat.gateway.aventus.io'
const SURI = "0xc011425c3b68fffb206fefb9bdb6e7277237972e0ff84f86150e6dea7ba9235d"
const USER = "5HWRHigp7xcja8XHtYazgqGWkmAoEf4AF3LqWmPcGuYRWgPt"; // user 2
const RELAYER = "5G6Sm1KRsowjMxAh4QfgdsueGNcqRFwSZyrbXnzdWrcaSRqT"; // dev relayer 2
const RECIPIENT = "5GsUygwedyh4TLT9kTfuJ31QVGwVfJe5qVhXzXiy2ubQ16jv"; // recipient 2
const SPLIT_FEE_TEST = false;
const RUNS = 500;

let relayerNonceStart = 0, relayerNonceEnd = 0;

describe('LOAD TEST', async () => {
  before(async () => {
    api = new AvnApi(GATEWAY_URL, { suri: SURI, relayer: RELAYER, hasPayer: SPLIT_FEE_TEST });
    await api.init();
  });

  it('can transfer AVT using a recipient address', async () => {
    const requestIds = [];
    const nonceStart = await api.query.getNonce(USER, 'token');
    const recipStart = await api.query.getAvtBalance(RECIPIENT);
    const timeStart = Date.now();

    console.log("User system nonce start:", nonceStart);
    console.log("Recipient balance start:", recipStart);

    let finalResult = true;
    console.log("");

    for (let j=0; j < RUNS; j++) {
      const reqId = await api.send.transferAvt(RECIPIENT, 1);
      requestIds.push(reqId);
      console.log(`Tx: ${j} Request Id: ${reqId}\t\t${new Date().toString().substring(16,25)}`);
    }

    const timeEndSend = Date.now();

    console.log("");
    console.log("Polling...");
    console.log("");

    for (let i=0; i < requestIds.length; i++) {
      let result = await confirmStatus(api, i, requestIds[i]);
      if (result === false) finalResult = false;
    }

    const timeEndPoll = Date.now()

    console.log("");
    console.log("Relayer nonce start:", relayerNonceStart.toString());
    console.log("Relayer nonce end  :", relayerNonceEnd);
    console.log("");
    console.log("User system nonce start:", nonceStart);
    console.log("User system nonce end  :", await api.query.getNonce(USER, 'token'));
    console.log("");
    console.log("Recipient balance start:", recipStart);
    console.log("Recipient balance end  :", await api.query.getAvtBalance(RECIPIENT));
    console.log("");
    console.log("Seconds to send:", parseInt((timeEndSend - timeStart)/1000).toString());
    console.log("Seconds to poll:", parseInt((timeEndPoll - timeEndSend)/1000).toString());
    console.log("");
    console.log("Final result: ", finalResult);
    console.log("DONE");
  });
});

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function confirmStatus(api, id, requestId) {
  let response, status;

  for (i = 0; i < 12; i++) {
    try {
      response = await api.poll.requestState(requestId);
      status = response.status;
      if (status === 'Processed' || status === 'Rejected' ) {
        console.log(`Tx: ${id} Request Id: ${requestId} Status: ${status}, relayer nonce: ${response.senderNonce}, block: ${response.blockNumber}, index ${response.transactionIndex}\t\t${new Date().toString().substring(16,25)}`);
        if (id === 0) relayerNonceStart = response.senderNonce - 1;
        relayerNonceEnd = response.senderNonce;
        return status === 'Processed';
      }
      console.log('\tStatus:', status);
    } catch (err) {
      console.log('polling error', err)
    }
    await sleep(10000);
  }
  console.log(`Tx: ${id} Request Id: ${requestId} Status: ${status}`);
}
