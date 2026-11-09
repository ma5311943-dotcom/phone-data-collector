const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const { sendSuccess } = require("../utils/response");
const { getOwnedDevice } = require("../utils/ownership");
const { optionalDate } = require("../utils/validation");

function requireNumber(value, field, { min, max }) {
  if (value === undefined || value === null || value === "") {
    throw new ApiError(400, `${field} is required.`, "VALIDATION_ERROR", {
      field,
    });
  }

  const number = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(number) || number < min || number > max) {
    throw new ApiError(
      400,
      `${field} must be a number between ${min} and ${max}.`,
      "VALIDATION_ERROR",
      { field },
    );
  }

  return number;
}

function optionalNumber(value, field, { min, max }) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return requireNumber(value, field, { min, max });
}

async function reportLocation(req, res) {
  const device = await getOwnedDevice(req.params.id, req.user.id);
  const body = req.body || {};
  const capturedAt =
    optionalDate(body.capturedAt, "capturedAt") || new Date();

  const record = await prisma.locationRecord.create({
    data: {
      userId: req.user.id,
      deviceId: device.id,
      latitude: requireNumber(body.latitude, "latitude", {
        min: -90,
        max: 90,
      }),
      longitude: requireNumber(body.longitude, "longitude", {
        min: -180,
        max: 180,
      }),
      accuracy: optionalNumber(body.accuracy, "accuracy", {
        min: 0,
        max: 100000,
      }),
      altitude: optionalNumber(body.altitude, "altitude", {
        min: -10000,
        max: 100000,
      }),
      capturedAt,
    },
  });

  await prisma.device.update({
    where: { id: device.id },
    data: { lastSyncedAt: new Date() },
  });

  return sendSuccess(res, record, { status: 201 });
}

async function getLocation(req, res) {
  const device = await getOwnedDevice(req.params.id, req.user.id);

  const [latest, records] = await prisma.$transaction([
    prisma.locationRecord.findFirst({
      where: { deviceId: device.id },
      orderBy: { capturedAt: "desc" },
    }),
    prisma.locationRecord.findMany({
      where: { deviceId: device.id },
      orderBy: { capturedAt: "desc" },
      take: 20,
    }),
  ]);

  return sendSuccess(res, { latest, records });
}

module.exports = { reportLocation, getLocation };
