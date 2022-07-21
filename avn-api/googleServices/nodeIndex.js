'use strict';

const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const NodeGoogleService = require('gds-avt');

dotenv.config();

const driveClientId = process.env.GOOGLE_DRIVE_CLIENT_ID || '';
const driveClientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET || '';
const driveRedirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI || '';
const driveRefreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN || '';

(async () => {
  const googleDriveService = new NodeGoogleService(driveClientId, driveClientSecret, driveRedirectUri, driveRefreshToken);

  const finalPath = path.resolve(__dirname, '../../finalReport.html');
  const folderName = 'TestReports';

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
  // Nightly_test_report_2022-07-19T08:02:43.621Z
  const date_now = new Date();
  let fileName = date_now.getHours() >= 6 ? 'Normal_test_report_' : 'Nightly_test_report_';
  await googleDriveService
      .saveFile(fileName + date_now.toISOString(), finalPath, 'text/html', folder.id)
      .catch((error) => {
    console.error(error);
  });

  console.info('File uploaded successfully!');

  // Delete the file on the server
  fs.unlinkSync(finalPath);
})();