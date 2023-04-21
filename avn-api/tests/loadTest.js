const AvnApi = require('../index.js');
const SURI = "0xc6d7eb5f8f6bcae9bdc01f24d672fee331d1540f2902812fd2ba93ffb89887c7"
const RELAYER = "5FbUQ2kJWLoqHuSTSNNqBwKwdQnBVe4HF3TeGyu6UoZaryTh";
const USER = "5HgmduT2woE1sm5maoXR3Ya3xiSeGxqgDpR1qDtYyVHKDuc3";
const RECIPIENT = "5HnPuKiHbyYBMV76vvA46fk6HZHDt7LU9R7YcyiWnBVzUhdu";
const RUNS = 100;

let relayerNonceStart, relayerNonceEnd;

describe('LOAD TEST', async () => {
  before(async () => {
    api = new AvnApi("https://uat.gateway.aventus.io", { suri: SURI, relayer: RELAYER });
    await api.init();
  });

  it('can transfer AVT using a recipient address', async () => {
    const requestIds = [];
    const nonceStart = await api.query.getNonce(USER, 'token');
    const recipStart = await api.query.getAvtBalance(RECIPIENT);
    const timeStart = Date.now();

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
      await confirmStatus(api, i, requestIds[i]);
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
    console.log("DONE");
  });
});

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function confirmStatus(api, id, requestId, expectedStatus, optionalTimeoutInMinutes) {
  let response, status;

  for (i = 0; i < 12; i++) {
    try {
      response = await api.poll.requestState(requestId);
      status = response.status;
      if (status === 'Processed' || status === 'Rejected' ) {
        console.log(`Tx: ${id} Request Id: ${requestId} Status: ${status}, relayer nonce: ${response.senderNonce}, block: ${response.blockNumber}, index ${response.transactionIndex}\t\t${new Date().toString().substring(16,25)}`);
        if (id === 0) relayerNonceStart = response.senderNonce - 1;
        relayerNonceEnd = response.senderNonce;
        return status === expectedStatus;
      }
    } catch (err) {
      console.log('polling error', err)
    }
    await sleep(10000);
  }
  console.log(`Tx: ${id} Request Id: ${requestId} Status: ${status}`);
}
