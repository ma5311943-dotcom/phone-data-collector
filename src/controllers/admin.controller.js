const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const { sendSuccess } = require("../utils/response");
const {
  requireString,
  requireEnum,
  parsePagination,
  buildPaginationMeta,
} = require("../utils/validation");

const MEDIA_TYPES = ["IMAGE", "VIDEO"];
const CALL_TYPES = ["INCOMING", "OUTGOING", "MISSED", "UNKNOWN"];
const SMS_DIRECTIONS = ["INBOUND", "OUTBOUND", "UNKNOWN"];

const DEVICE_COUNTS = {
  select: {
    assignments: true,
    documents: true,
    media: true,
    contacts: true,
    callRecords: true,
    smsRecords: true,
    syncHistories: true,
  },
};

function selectedDevice(device) {
  if (!device) {
    return null;
  }

  return {
    id: device.id,
    name: device.name,
    platform: device.platform,
    model: device.model,
    osVersion: device.osVersion,
    isActive: device.isActive,
    lastSyncedAt: device.lastSyncedAt,
    createdAt: device.createdAt,
  };
}

function deviceWhere(query) {
  const where = {};

  if (query.deviceId !== undefined) {
    where.deviceId = requireString(query.deviceId, "deviceId", {
      max: 64,
    });
  }

  return where;
}

async function getOverview(req, res) {
  const [
    totalDevices,
    activeDevices,
    totalAssignments,
    totalDocuments,
    totalImages,
    totalVideos,
    totalContacts,
    totalCallRecords,
    totalSmsRecords,
    devices,
    recentSyncs,
  ] = await prisma.$transaction([
    prisma.device.count(),
    prisma.device.count({ where: { isActive: true } }),
    prisma.assignment.count(),
    prisma.document.count(),
    prisma.media.count({ where: { mediaType: "IMAGE" } }),
    prisma.media.count({ where: { mediaType: "VIDEO" } }),
    prisma.contact.count(),
    prisma.authorizedCallRecord.count(),
    prisma.authorizedSmsRecord.count(),
    prisma.device.findMany({
      orderBy: [{ lastSyncedAt: "desc" }, { createdAt: "desc" }],
      take: 10,
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        deviceInfo: true,
        locationRecords: { orderBy: { capturedAt: "desc" }, take: 1 },
        _count: DEVICE_COUNTS,
      },
    }),
    prisma.syncHistory.findMany({
      orderBy: { startedAt: "desc" },
      take: 10,
      include: {
        device: { select: { id: true, name: true, model: true } },
      },
    }),
  ]);

  return sendSuccess(res, {
    totals: {
      devices: totalDevices,
      activeDevices,
      assignments: totalAssignments,
      documents: totalDocuments,
      images: totalImages,
      videos: totalVideos,
      contacts: totalContacts,
      callRecords: totalCallRecords,
      smsRecords: totalSmsRecords,
    },
    devices,
    recentSyncs,
  });
}

async function listDevices(req, res) {
  const { page, limit, skip, take } = parsePagination(req.query);

  const [devices, total] = await prisma.$transaction([
    prisma.device.findMany({
      skip,
      take,
      orderBy: [{ lastSyncedAt: "desc" }, { createdAt: "desc" }],
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        deviceInfo: true,
        locationRecords: { orderBy: { capturedAt: "desc" }, take: 1 },
        _count: DEVICE_COUNTS,
      },
    }),
    prisma.device.count(),
  ]);

  return sendSuccess(res, devices, {
    meta: buildPaginationMeta(total, page, limit),
  });
}

async function getDevice(req, res) {
  const id = requireString(req.params.id, "id", { max: 64 });

  const device = await prisma.device.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, fullName: true, email: true, role: true },
      },
      deviceInfo: true,
      _count: DEVICE_COUNTS,
      locationRecords: { orderBy: { capturedAt: "desc" }, take: 20 },
      assignments: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { documents: { orderBy: { createdAt: "desc" } } },
      },
      documents: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { assignment: { select: { id: true, title: true } } },
      },
      media: { orderBy: { createdAt: "desc" }, take: 30 },
      contacts: { orderBy: { name: "asc" }, take: 50 },
      callRecords: {
        orderBy: { startedAt: "desc" },
        take: 20,
        include: { contact: { select: { id: true, name: true } } },
      },
      smsRecords: {
        orderBy: { sentAt: "desc" },
        take: 20,
        include: { contact: { select: { id: true, name: true } } },
      },
      syncHistories: { orderBy: { startedAt: "desc" }, take: 10 },
    },
  });

  if (!device) {
    throw new ApiError(404, "Device not found.", "DEVICE_NOT_FOUND");
  }

  return sendSuccess(res, device);
}

async function listMedia(req, res) {
  const { page, limit, skip, take } = parsePagination(req.query);
  const where = deviceWhere(req.query);

  if (req.query.mediaType !== undefined) {
    where.mediaType = requireEnum(
      req.query.mediaType,
      "mediaType",
      MEDIA_TYPES,
    );
  }

  if (req.query.search !== undefined) {
    where.fileName = {
      contains: requireString(req.query.search, "search", { max: 120 }),
    };
  }

  const [media, total] = await prisma.$transaction([
    prisma.media.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        device: {
          select: {
            id: true,
            name: true,
            model: true,
            user: { select: { fullName: true, email: true } },
          },
        },
      },
    }),
    prisma.media.count({ where }),
  ]);

  return sendSuccess(res, media, {
    meta: buildPaginationMeta(total, page, limit),
  });
}

async function listDocuments(req, res) {
  const { page, limit, skip, take } = parsePagination(req.query);
  const where = deviceWhere(req.query);

  if (req.query.fileType !== undefined) {
    where.fileType = requireString(req.query.fileType, "fileType", {
      max: 100,
    }).toLowerCase();
  }

  if (req.query.search !== undefined) {
    where.fileName = {
      contains: requireString(req.query.search, "search", { max: 120 }),
    };
  }

  const [documents, total] = await prisma.$transaction([
    prisma.document.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        assignment: { select: { id: true, title: true } },
        device: {
          select: {
            id: true,
            name: true,
            model: true,
            user: { select: { fullName: true, email: true } },
          },
        },
      },
    }),
    prisma.document.count({ where }),
  ]);

  return sendSuccess(res, documents, {
    meta: buildPaginationMeta(total, page, limit),
  });
}

async function listAssignments(req, res) {
  const { page, limit, skip, take } = parsePagination(req.query);
  const where = deviceWhere(req.query);

  if (req.query.search !== undefined) {
    where.title = {
      contains: requireString(req.query.search, "search", { max: 120 }),
    };
  }

  const [assignments, total] = await prisma.$transaction([
    prisma.assignment.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, fullName: true, email: true } },
        device: selectedDeviceInclude(),
        documents: { orderBy: { createdAt: "desc" } },
        _count: { select: { documents: true } },
      },
    }),
    prisma.assignment.count({ where }),
  ]);

  return sendSuccess(res, assignments, {
    meta: buildPaginationMeta(total, page, limit),
  });
}

function selectedDeviceInclude() {
  return {
    select: {
      id: true,
      name: true,
      platform: true,
      model: true,
      user: { select: { fullName: true, email: true } },
    },
  };
}

async function listContacts(req, res) {
  const { page, limit, skip, take } = parsePagination(req.query);
  const where = deviceWhere(req.query);

  if (req.query.search !== undefined) {
    const search = requireString(req.query.search, "search", { max: 120 });
    where.OR = [
      { name: { contains: search } },
      { phoneNumber: { contains: search } },
    ];
  }

  const [contacts, total] = await prisma.$transaction([
    prisma.contact.findMany({
      where,
      skip,
      take,
      orderBy: { name: "asc" },
      include: {
        device: {
          select: {
            id: true,
            name: true,
            model: true,
            user: { select: { fullName: true, email: true } },
          },
        },
      },
    }),
    prisma.contact.count({ where }),
  ]);

  return sendSuccess(res, contacts, {
    meta: buildPaginationMeta(total, page, limit),
  });
}

async function listCallRecords(req, res) {
  const { page, limit, skip, take } = parsePagination(req.query);
  const where = deviceWhere(req.query);

  if (req.query.callType !== undefined) {
    where.callType = requireEnum(
      req.query.callType,
      "callType",
      CALL_TYPES,
    );
  }

  const [records, total] = await prisma.$transaction([
    prisma.authorizedCallRecord.findMany({
      where,
      skip,
      take,
      orderBy: { startedAt: "desc" },
      include: {
        contact: { select: { id: true, name: true } },
        device: selectedDeviceInclude(),
      },
    }),
    prisma.authorizedCallRecord.count({ where }),
  ]);

  return sendSuccess(res, records, {
    meta: buildPaginationMeta(total, page, limit),
  });
}

async function listSmsRecords(req, res) {
  const { page, limit, skip, take } = parsePagination(req.query);
  const where = deviceWhere(req.query);

  if (req.query.direction !== undefined) {
    where.direction = requireEnum(
      req.query.direction,
      "direction",
      SMS_DIRECTIONS,
    );
  }

  const [records, total] = await prisma.$transaction([
    prisma.authorizedSmsRecord.findMany({
      where,
      skip,
      take,
      orderBy: { sentAt: "desc" },
      include: {
        contact: { select: { id: true, name: true } },
        device: selectedDeviceInclude(),
      },
    }),
    prisma.authorizedSmsRecord.count({ where }),
  ]);

  return sendSuccess(res, records, {
    meta: buildPaginationMeta(total, page, limit),
  });
}

async function listSyncHistory(req, res) {
  const { page, limit, skip, take } = parsePagination(req.query);
  const where = deviceWhere(req.query);

  const [history, total] = await prisma.$transaction([
    prisma.syncHistory.findMany({
      where,
      skip,
      take,
      orderBy: { startedAt: "desc" },
      include: {
        device: { select: { id: true, name: true, model: true } },
        user: { select: { id: true, fullName: true, email: true } },
      },
    }),
    prisma.syncHistory.count({ where }),
  ]);

  return sendSuccess(res, history, {
    meta: buildPaginationMeta(total, page, limit),
  });
}

module.exports = {
  getOverview,
  listDevices,
  getDevice,
  listMedia,
  listDocuments,
  listAssignments,
  listContacts,
  listCallRecords,
  listSmsRecords,
  listSyncHistory,
};
