'use strict';
module.exports = NodeGoogleService;

const fs = require('fs');
const { google } = require('googleapis');

function NodeGoogleService(clientId, clientSecret, redirectUri, refreshToken) {
  this.driveClient = this.createDriveClient(clientId, clientSecret, redirectUri, refreshToken);
}

NodeGoogleService.prototype.createDriveClient = function(clientId, clientSecret, redirectUri, refreshToken) {
  const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  client.setCredentials({ refresh_token: refreshToken });

  return google.drive({
    version: 'v3',
    auth: client,
  });
}

NodeGoogleService.prototype.createFolder = async function(folderName) {
  const res = await this.driveClient.files.create({
      resource: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id, name',
    });
  return res.data || undefined;
}

NodeGoogleService.prototype.searchFolder = async function(folderName) {
  const res = await this.driveClient.files.list(
    {
        q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}'`,
        fields: 'files(id, name)',
    });
  return res.data.files ? res.data.files[0] : null;
}

NodeGoogleService.prototype.saveFile = function(fileName, filePath, fileMimeType, folderId) {
  return this.driveClient.files.create({
    requestBody: {
      name: fileName,
      mimeType: fileMimeType,
      parents: folderId ? [folderId] : [],
    },
    media: {
      mimeType: fileMimeType,
      body: fs.createReadStream(filePath),
    },
  });
}