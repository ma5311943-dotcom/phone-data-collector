const prisma = require("../config/prisma");
const { sendSuccess } = require("../utils/response");
const { getOwnedDevice } = require("../utils/ownership");
const {
  requireString,
  requireEnum,
  optionalBoolean,
  optionalDate,
  parsePagination,
  buildPaginationMeta,
} = require("../utils/validation");

const CALL_TYPES = ["INCOMING", "OUTGOING", "MISSED", "UNKNOWN"];
const SMS_DIRECTIONS = ["INBOUND", "OUTBOUND", "UNKNOWN"];

async function getDeviceFilter(query, userId) {
  if (query.deviceId === undefined) {
    return null;
  }

  const deviceId = requireString(query.deviceId, "deviceId", {
    max: 64,
  });

  return getOwnedDevice(deviceId, userId);
}

function buildDateRange(query) {
  const from =
    query.from !== undefined ? optionalDate(query.from, "from") : null;
  const to = query.to !== undefined ? optionalDate(query.to, "to") : null;

  if (!from && !to) {
    return undefined;
  }

  return {
    ...(from ? { gte: from } : {}),
    ...(to ? { lte: to } : {}),
  };
}

async function listContacts(req, res) {
  const device = await getDeviceFilter(req.query, req.user.id);
  const { page, limit, skip, take } = parsePagination(req.query);
  const where = { userId: req.user.id };

  if (device) {
    where.deviceId = device.id;
  }

  if (req.query.search !== undefined) {
    const search = requireString(req.query.search, "search", {
      max: 100,
    });

    where.OR = [
      { name: { contains: search } },
      { phoneNumber: { contains: search } },
    ];
  }

  if (req.query.authorized !== undefined) {
    where.isAuthorized = optionalBoolean(
      req.query.authorized,
      "authorized",
      true,
    );
  }

  const [contacts, total] = await prisma.$transaction([
    prisma.contact.findMany({
      where,
      skip,
      take,
      orderBy: { name: "asc" },
      include: {
        device: { select: { id: true, name: true, platform: true } },
      },
    }),
    prisma.contact.count({ where }),
  ]);

  return sendSuccess(res, contacts, {
    meta: buildPaginationMeta(total, page, limit),
  });
}

async function listCallRecords(req, res) {
  const device = await getDeviceFilter(req.query, req.user.id);
  const { page, limit, skip, take } = parsePagination(req.query);
  const where = { userId: req.user.id };

  if (device) {
    where.deviceId = device.id;
  }

  if (req.query.callType !== undefined) {
    where.callType = requireEnum(
      req.query.callType,
      "callType",
      CALL_TYPES,
    );
  }

  if (req.query.authorized !== undefined) {
    where.isAuthorized = optionalBoolean(
      req.query.authorized,
      "authorized",
      true,
    );
  }

  const startedAt = buildDateRange(req.query);

  if (startedAt) {
    where.startedAt = startedAt;
  }

  const [records, total] = await prisma.$transaction([
    prisma.authorizedCallRecord.findMany({
      where,
      skip,
      take,
      orderBy: { startedAt: "desc" },
      include: {
        contact: { select: { id: true, name: true } },
        device: { select: { id: true, name: true, platform: true } },
      },
    }),
    prisma.authorizedCallRecord.count({ where }),
  ]);

  return sendSuccess(res, records, {
    meta: buildPaginationMeta(total, page, limit),
  });
}

async function listSmsRecords(req, res) {
  const device = await getDeviceFilter(req.query, req.user.id);
  const { page, limit, skip, take } = parsePagination(req.query);
  const where = { userId: req.user.id };

  if (device) {
    where.deviceId = device.id;
  }

  if (req.query.direction !== undefined) {
    where.direction = requireEnum(
      req.query.direction,
      "direction",
      SMS_DIRECTIONS,
    );
  }

  if (req.query.authorized !== undefined) {
    where.isAuthorized = optionalBoolean(
      req.query.authorized,
      "authorized",
      true,
    );
  }

  const sentAt = buildDateRange(req.query);

  if (sentAt) {
    where.sentAt = sentAt;
  }

  const [records, total] = await prisma.$transaction([
    prisma.authorizedSmsRecord.findMany({
      where,
      skip,
      take,
      orderBy: { sentAt: "desc" },
      include: {
        contact: { select: { id: true, name: true } },
        device: { select: { id: true, name: true, platform: true } },
      },
    }),
    prisma.authorizedSmsRecord.count({ where }),
  ]);

  return sendSuccess(res, records, {
    meta: buildPaginationMeta(total, page, limit),
  });
}

module.exports = { listContacts, listCallRecords, listSmsRecords };
