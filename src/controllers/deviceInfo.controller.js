const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const { sendSuccess } = require("../utils/response");
const { getOwnedDevice } = require("../utils/ownership");
const {
  optionalString,
  optionalBoolean,
  hasOwn,
} = require("../utils/validation");

function optionalIntOrNull(value, field, { min = 0, max = 2147483647 } = {}) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const number = typeof value === "number" ? value : Number(value);

  if (!Number.isInteger(number) || number < min || number > max) {
    throw new ApiError(
      400,
      `${field} must be an integer between ${min} and ${max}.`,
      "VALIDATION_ERROR",
      { field },
    );
  }

  return number;
}

async function reportDeviceInfo(req, res) {
  const device = await getOwnedDevice(req.params.id, req.user.id);
  const body = req.body || {};
  const now = new Date();

  const data = {
    brand: optionalString(body.brand, "brand", { max: 80 }),
    manufacturer: optionalString(body.manufacturer, "manufacturer", {
      max: 120,
    }),
    modelName: optionalString(body.modelName, "modelName", { max: 120 }),
    deviceName: optionalString(body.deviceName, "deviceName", { max: 120 }),
    androidVersion: optionalString(body.androidVersion, "androidVersion", {
      max: 30,
    }),
    apiLevel: optionalIntOrNull(body.apiLevel, "apiLevel", {
      min: 1,
      max: 100,
    }),
    batteryLevel: optionalIntOrNull(body.batteryLevel, "batteryLevel", {
      min: 0,
      max: 100,
    }),
    batteryState: optionalString(body.batteryState, "batteryState", {
      max: 30,
    }),
    isCharging: optionalBoolean(body.isCharging, "isCharging", null),
    totalStorageMb: optionalIntOrNull(body.totalStorageMb, "totalStorageMb", {
      min: 0,
      max: 4194304,
    }),
    freeStorageMb: optionalIntOrNull(body.freeStorageMb, "freeStorageMb", {
      min: 0,
      max: 4194304,
    }),
    totalMemoryMb: optionalIntOrNull(body.totalMemoryMb, "totalMemoryMb", {
      min: 0,
      max: 1048576,
    }),
    usedMemoryMb: optionalIntOrNull(body.usedMemoryMb, "usedMemoryMb", {
      min: 0,
      max: 1048576,
    }),
    networkType: optionalString(body.networkType, "networkType", {
      max: 30,
    }),
    isConnected: optionalBoolean(body.isConnected, "isConnected", null),
    ipAddress: optionalString(body.ipAddress, "ipAddress", { max: 64 }),
    reportedAt: now,
  };

  const info = await prisma.deviceInfo.upsert({
    where: { deviceId: device.id },
    create: {
      userId: req.user.id,
      deviceId: device.id,
      ...data,
    },
    update: data,
  });

  const deviceUpdate = { lastSyncedAt: now };

  if (data.modelName) {
    deviceUpdate.model = data.modelName;
  }

  if (data.androidVersion) {
    deviceUpdate.osVersion = data.androidVersion;
  }

  if (data.deviceName && hasOwn(body, "deviceName")) {
    deviceUpdate.name = data.deviceName;
  }

  await prisma.device.update({
    where: { id: device.id },
    data: deviceUpdate,
  });

  return sendSuccess(res, info);
}

async function getDeviceInfo(req, res) {
  const device = await getOwnedDevice(req.params.id, req.user.id);

  const info = await prisma.deviceInfo.findUnique({
    where: { deviceId: device.id },
  });

  return sendSuccess(res, info);
}

module.exports = { reportDeviceInfo, getDeviceInfo };
