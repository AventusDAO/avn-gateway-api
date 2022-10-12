'use strict';

const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const NodeGoogleService = require('avn-gdus');
const yargs = require('yargs');

let argv = yargs
  .usage('Run upload using a given Gateway environment')
  .help('h')
  .alias('h', 'help')
  .demandOption('c')
  .describe('c', 'Configuration file with gateway parameters')
  .string('c')
  .alias('c', 'gateway')
  .argv;

dotenv.config();

const serviceAccountKey = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY;
const sharedDriveId = process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID;

const test_descriptive = argv.test_descriptive || '';

(async () => {
  const googleDriveService = new NodeGoogleService(serviceAccountKey);

  const finalPath = path.resolve(__dirname, '../../finalReport.html');
  const folderName = 'GatewayTestResults';

  if (!fs.existsSync(finalPath)) {
    throw new Error('File not found!');
  }

  let folder = await googleDriveService
      .searchSharedFolder(sharedDriveId, folderName)
      .catch((error) => {
    console.error(error);
    return null;
  });

  if (!folder) {
    console.log("Please provide a valid shared drive Id")
    return;
  }

  // Example file name
  // uat_gateway_api_nightly_test_report_2022-07-19T08:02:43.621Z
  const date_now = new Date();
  let fileName = test_descriptive ? `_${test_descriptive}_` : '_gateway_api_nightly_test_report_';
  await googleDriveService
      .saveFile(argv.gateway + fileName + date_now.toISOString(), finalPath, 'text/html', folder.id)
      .catch((error) => {
    console.error(error);
  });

  console.info('File uploaded successfully!');

  // Delete the file on the server
  fs.unlinkSync(finalPath);
})();