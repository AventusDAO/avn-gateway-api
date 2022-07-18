import dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

import { GoogleDriveService } from './googleDriveService';
console.log('ENVS B4')

dotenv.config();

console.log('ENVS AFTER')
console.log(process.env)

const driveClientId = process.env.GOOGLE_DRIVE_CLIENT_ID || '';
const driveClientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET || '';
const driveRedirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI || '';
const driveRefreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN || '';

(async () => {
  console.log('ENVS')
  console.log(driveClientId)
  console.log(driveClientSecret)
  console.log(driveRedirectUri)
  console.log(driveRefreshToken)
  console.log('ENVS END')
  const googleDriveService = new GoogleDriveService(driveClientId, driveClientSecret, driveRedirectUri, driveRefreshToken);

  const finalPath = path.resolve(__dirname, '../../finalReport.html');
  const folderName = 'TestReports';

  if (!fs.existsSync(finalPath)) {
    throw new Error('File not found!');
  }

  let folder = await googleDriveService.searchFolder(folderName).catch((error) => {
    console.error(error);
    return null;
  });

  if (!folder) {
    folder = await googleDriveService.createFolder(folderName);
  }

  await googleDriveService.saveFile('finalReport', finalPath, 'text/html', folder.id).catch((error: any) => {
    console.error(error);
  });

  console.info('File uploaded successfully!');

  // Delete the file on the server
  fs.unlinkSync(finalPath);
})();