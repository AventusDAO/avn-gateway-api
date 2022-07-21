'use strict';

const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const NodeGoogleService = require('gds-avt');
const yargs = require('yargs');

let argv = yargs
  .usage('Run baseStateGenerator using a given Gateway environment')
  .help('h')
  .alias('h', 'help')
  .demandOption('c')
  .describe('c', 'Configuration file with gateway parameters')
  .string('c')
  .alias('c', 'gateway')
  .argv;

dotenv.config();

const driveClientId = process.env.GOOGLE_DRIVE_CLIENT_ID || '';
const driveClientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET || '';
const driveRedirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI || '';
const driveRefreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN || '';

const test_descriptive = argv.test_descriptive || '';

(async () => {
  const googleDriveService = new NodeGoogleService(driveClientId, driveClientSecret, driveRedirectUri, driveRefreshToken);

  const finalPath = path.resolve(__dirname, '../../finalReport.html');
  const folderName = 'GatewayTestResults';

  if (!fs.existsSync(finalPath)) {
    throw new Error('File not found!');
  }

  let folder = await googleDriveService
      .searchFolder(folderName)
      .catch((error) => {
    console.error(error);
    return null;
  });

  if (!folder) {
    folder = await googleDriveService.createFolder(folderName);
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