const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const { sendSuccess } = require("../utils/response");
const { getOwnedDevice } = require("../utils/ownership");
const {
  requireString,
  optionalString,
  requireEnum,
  optionalEnum,
  optionalBoolean,
  optionalInt,
  requireDate,
  optionalDate,
  normalizePhoneNumber,
  optionalEmail,
  requireArray,
  requireObject,
  parsePagination,
  buildPaginationMeta,
  hasOwn,
} = require("../utils/validation");

const PLATFORMS = ["ANDROID", "IOS", "WEB", "OTHER"];
const CALL_TYPES = ["INCOMING", "OUTGOING", "MISSED", "UNKNOWN"];
const SMS_DIRECTIONS = ["INBOUND", "OUTBOUND", "UNKNOWN"];
const SYNC_TYPES = ["FULL", "INCREMENTAL", "MANUAL"];
const SYNC_STATUSES = ["IN_PROGRESS", "SUCCESS", "FAILED"];

const DEVICE_INCLUDE = {
  _count: {
    select: {
      assignments: true,
      documents: true,
      media: true,
      contacts: true,
      callRecords: true,
      smsRecords: true,
      syncHistories: true,
    },
  },
};

function parseContactInput(value, index) {
  const field = `contacts[${index}]`;
  const item = requireObject(value, field);
  const phoneNumber = normalizePhoneNumber(
    item.phoneNumber,
    `${field}.phoneNumber`,
  );

  return {
    phoneNumber,
    name:
      optionalString(item.name, `${field}.name`, { max: 160 }) ||
      phoneNumber,
    email: optionalEmail(item.email, `${field}.email`),
    isAuthorized: optionalBoolean(
      item.isAuthorized,
      `${field}.isAuthorized`,
      true,
    ),
    externalId: optionalString(item.externalId, `${field}.externalId`, {
      max: 191,
    }),
  };
}

function parseCallRecordInput(value, index) {
  const field = `callRecords[${index}]`;
  const item = requireObject(value, field);

  return {
    phoneNumber: normalizePhoneNumber(
      item.phoneNumber,
      `${field}.phoneNumber`,
    ),
    callType: optionalEnum(
      item.callType,
      `${field}.callType`,
      CALL_TYPES,
      "UNKNOWN",
    ),
    startedAt: requireDate(item.startedAt, `${field}.startedAt`),
    durationSeconds: optionalInt(
      item.durationSeconds,
      `${field}.durationSeconds`,
      { min: 0, max: 86400 },
    ),
    isAuthorized: optionalBoolean(
      item.isAuthorized,
      `${field}.isAuthorized`,
      true,
    ),
    externalId: optionalString(item.externalId, `${field}.externalId`, {
      max: 191,
    }),
  };
}

function parseSmsRecordInput(value, index) {
  const field = `smsRecords[${index}]`;
  const item = requireObject(value, field);

  return {
    phoneNumber: normalizePhoneNumber(
      item.phoneNumber,
      `${field}.phoneNumber`,
    ),
    direction: optionalEnum(
      item.direction,
      `${field}.direction`,
      SMS_DIRECTIONS,
      "UNKNOWN",
    ),
    body: optionalString(item.body, `${field}.body`, { max: 5000 }),
    sentAt: requireDate(item.sentAt, `${field}.sentAt`),
    isAuthorized: optionalBoolean(
      item.isAuthorized,
      `${field}.isAuthorized`,
      true,
    ),
    externalId: optionalString(item.externalId, `${field}.externalId`, {
      max: 191,
    }),
  };
}

async function registerDevice(req, res) {
  const deviceIdentifier = requireString(
    req.body.deviceIdentifier,
    "deviceIdentifier",
    { max: 191 },
  );
  const platform = requireEnum(req.body.platform, "platform", PLATFORMS);
  const name = optionalString(
    req.body.name ?? req.body.deviceName,
    "name",
    { max: 120 },
  );
  const model = optionalString(req.body.model, "model", { max: 120 });
  const osVersion = optionalString(req.body.osVersion, "osVersion", {
    max: 50,
  });
  const appVersion = optionalString(req.body.appVersion, "appVersion", {
    max: 50,
  });
  const pushToken = optionalString(req.body.pushToken, "pushToken", {
    max: 255,
  });

  const update = { platform, isActive: true };

  if (name) {
    update.name = name;
  }

  if (hasOwn(req.body, "model")) {
    update.model = model;
  }

  if (hasOwn(req.body, "osVersion")) {
    update.osVersion = osVersion;
  }

  if (hasOwn(req.body, "appVersion")) {
    update.appVersion = appVersion;
  }

  if (hasOwn(req.body, "pushToken")) {
    update.pushToken = pushToken;
  }

  const device = await prisma.device.upsert({
    where: {
      userId_deviceIdentifier: {
        userId: req.user.id,
        deviceIdentifier,
      },
    },
    create: {
      userId: req.user.id,
      deviceIdentifier,
      name: name || "Unnamed device",
      platform,
      model,
      osVersion,
      appVersion,
      pushToken,
    },
    update,
    include: DEVICE_INCLUDE,
  });

  return sendSuccess(res, device);
}

async function listDevices(req, res) {
  const { page, limit, skip, take } = parsePagination(req.query);

  const [devices, total] = await prisma.$transaction([
    prisma.device.findMany({
      where: { userId: req.user.id },
      skip,
      take,
      orderBy: [
        { isActive: "desc" },
        { lastSyncedAt: "desc" },
        { createdAt: "desc" },
      ],
      include: DEVICE_INCLUDE,
    }),
    prisma.device.count({ where: { userId: req.user.id } }),
  ]);

  return sendSuccess(res, devices, {
    meta: buildPaginationMeta(total, page, limit),
  });
}

async function getDevice(req, res) {
  const ownedDevice = await getOwnedDevice(
    req.params.id,
    req.user.id,
  );

  const device = await prisma.device.findUnique({
    where: { id: ownedDevice.id },
    include: DEVICE_INCLUDE,
  });

  return sendSuccess(res, device);
}

async function updateDevice(req, res) {
  const device = await getOwnedDevice(req.params.id, req.user.id);
  const data = {};

  if (hasOwn(req.body, "name")) {
    data.name = requireString(req.body.name, "name", { max: 120 });
  }

  if (hasOwn(req.body, "platform")) {
    data.platform = requireEnum(
      req.body.platform,
      "platform",
      PLATFORMS,
    );
  }

  if (hasOwn(req.body, "model")) {
    data.model = optionalString(req.body.model, "model", { max: 120 });
  }

  if (hasOwn(req.body, "osVersion")) {
    data.osVersion = optionalString(req.body.osVersion, "osVersion", {
      max: 50,
    });
  }

  if (hasOwn(req.body, "appVersion")) {
    data.appVersion = optionalString(req.body.appVersion, "appVersion", {
      max: 50,
    });
  }

  if (hasOwn(req.body, "pushToken")) {
    data.pushToken = optionalString(req.body.pushToken, "pushToken", {
      max: 255,
    });
  }

  if (hasOwn(req.body, "isActive")) {
    data.isActive = optionalBoolean(
      req.body.isActive,
      "isActive",
      device.isActive,
    );
  }

  if (Object.keys(data).length === 0) {
    throw new ApiError(
      400,
      "No valid fields were provided for update.",
      "NO_UPDATE_FIELDS",
    );
  }

  const updated = await prisma.device.update({
    where: { id: device.id },
    data,
    include: DEVICE_INCLUDE,
  });

  return sendSuccess(res, updated);
}

async function deactivateDevice(req, res) {
  const device = await getOwnedDevice(req.params.id, req.user.id);

  const updated = await prisma.device.update({
    where: { id: device.id },
    data: { isActive: false },
    include: DEVICE_INCLUDE,
  });

  return sendSuccess(res, updated);
}

async function syncDevice(req, res) {
  const device = await getOwnedDevice(req.params.id, req.user.id, {
    allowInactive: false,
  });

  const contacts = requireArray(req.body.contacts, "contacts").map(
    parseContactInput,
  );
  const callRecords = requireArray(
    req.body.callRecords,
    "callRecords",
  ).map(parseCallRecordInput);
  const smsRecords = requireArray(
    req.body.smsRecords,
    "smsRecords",
  ).map(parseSmsRecordInput);
  const syncType = optionalEnum(
    req.body.syncType,
    "syncType",
    SYNC_TYPES,
    "MANUAL",
  );
  const deviceSyncedAt = optionalDate(req.body.syncedAt, "syncedAt");

  const history = await prisma.syncHistory.create({
    data: {
      userId: req.user.id,
      deviceId: device.id,
      syncType,
      status: "IN_PROGRESS",
      deviceSyncedAt,
    },
  });

  let syncHistory;
  const counts = {
    contacts: contacts.length,
    callRecords: 0,
    smsRecords: 0,
  };

  try {
    syncHistory = await prisma.$transaction(async (transaction) => {
      if (contacts.length > 0) {
        await Promise.all(
          contacts.map((contact) =>
            transaction.contact.upsert({
              where: {
                deviceId_phoneNumber: {
                  deviceId: device.id,
                  phoneNumber: contact.phoneNumber,
                },
              },
              create: {
                userId: req.user.id,
                deviceId: device.id,
                ...contact,
              },
              update: {
                name: contact.name,
                email: contact.email,
                isAuthorized: contact.isAuthorized,
                externalId: contact.externalId,
              },
            }),
          ),
        );
      }

      let contactIdByPhone = new Map();

      if (callRecords.length > 0 || smsRecords.length > 0) {
        const knownContacts = await transaction.contact.findMany({
          where: { deviceId: device.id },
          select: { id: true, phoneNumber: true },
        });

        contactIdByPhone = new Map(
          knownContacts.map((contact) => [
            contact.phoneNumber,
            contact.id,
          ]),
        );
      }

      if (callRecords.length > 0) {
        const result = await transaction.authorizedCallRecord.createMany({
          data: callRecords.map((record) => ({
            userId: req.user.id,
            deviceId: device.id,
            contactId: contactIdByPhone.get(record.phoneNumber) || null,
            ...record,
          })),
          skipDuplicates: true,
        });
        counts.callRecords = result.count;
      }

      if (smsRecords.length > 0) {
        const result = await transaction.authorizedSmsRecord.createMany({
          data: smsRecords.map((record) => ({
            userId: req.user.id,
            deviceId: device.id,
            contactId: contactIdByPhone.get(record.phoneNumber) || null,
            ...record,
          })),
          skipDuplicates: true,
        });
        counts.smsRecords = result.count;
      }

      const completedAt = new Date();

      const updatedHistory = await transaction.syncHistory.update({
        where: { id: history.id },
        data: {
          status: "SUCCESS",
          completedAt,
          itemsSynced:
            counts.contacts + counts.callRecords + counts.smsRecords,
          stats: {
            contactsReceived: contacts.length,
            contactsUpserted: contacts.length,
            callRecordsReceived: callRecords.length,
            callRecordsStored: counts.callRecords,
            smsRecordsReceived: smsRecords.length,
            smsRecordsStored: counts.smsRecords,
          },
        },
      });

      await transaction.device.update({
        where: { id: device.id },
        data: { lastSyncedAt: completedAt },
      });

      return updatedHistory;
    }, {
      maxWait: 10000,
      timeout: 30000,
    });
  } catch (error) {
    await prisma.syncHistory
      .update({
        where: { id: history.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          errorMessage: String(error.message || error).slice(0, 2000),
        },
      })
      .catch(() => {});

    throw error;
  }

  return sendSuccess(
    res,
    {
      syncHistory,
      counts,
    },
    { status: 201 },
  );
}

async function listSyncHistory(req, res) {
  const device = await getOwnedDevice(req.params.id, req.user.id);
  const { page, limit, skip, take } = parsePagination(req.query);
  const where = { deviceId: device.id, userId: req.user.id };

  if (req.query.status !== undefined) {
    where.status = requireEnum(
      req.query.status,
      "status",
      SYNC_STATUSES,
    );
  }

  if (req.query.syncType !== undefined) {
    where.syncType = requireEnum(
      req.query.syncType,
      "syncType",
      SYNC_TYPES,
    );
  }

  const [history, total] = await prisma.$transaction([
    prisma.syncHistory.findMany({
      where,
      skip,
      take,
      orderBy: { startedAt: "desc" },
    }),
    prisma.syncHistory.count({ where }),
  ]);

  return sendSuccess(res, history, {
    meta: buildPaginationMeta(total, page, limit),
  });
}

module.exports = {
  registerDevice,
  listDevices,
  getDevice,
  updateDevice,
  deactivateDevice,
  syncDevice,
  listSyncHistory,
};
