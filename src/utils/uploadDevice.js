const { getOptionalOwnedDevice } = require("./ownership");
const { discardUploadedFile } = require("../services/storage.service");
const { optionalString } = require("./validation");

async function resolveUploadDevice(req, userId) {
  const deviceId = optionalString(req.body && req.body.deviceId, "deviceId", {
    max: 64,
  });

  if (!deviceId) {
    return null;
  }

  try {
    return await getOptionalOwnedDevice(deviceId, userId);
  } catch (error) {
    await discardUploadedFile(req.file);
    throw error;
  }
}

module.exports = { resolveUploadDevice };
