const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const { sendSuccess } = require("../utils/response");
const { resolveUploadDevice } = require("../utils/uploadDevice");
const {
  createMediaFromUpload,
  deleteMediaRecord,
} = require("../services/storage.service");
const {
  requireEnum,
  requireString,
  parsePagination,
  buildPaginationMeta,
} = require("../utils/validation");

const MEDIA_TYPES = ["IMAGE", "VIDEO"];

async function uploadMedia(req, res) {
  const device = await resolveUploadDevice(req, req.user.id);
  const media = await createMediaFromUpload({
    file: req.file,
    userId: req.user.id,
    deviceId: device ? device.id : null,
  });

  return sendSuccess(res, media, { status: 201 });
}

async function listMedia(req, res) {
  const { page, limit, skip, take } = parsePagination(req.query);
  const where = { userId: req.user.id };

  if (req.query.mediaType !== undefined) {
    where.mediaType = requireEnum(
      req.query.mediaType,
      "mediaType",
      MEDIA_TYPES,
    );
  }

  if (req.query.deviceId !== undefined) {
    const deviceId = requireString(req.query.deviceId, "deviceId", {
      max: 64,
    });

    const device = await prisma.device.findFirst({
      where: { id: deviceId, userId: req.user.id },
      select: { id: true },
    });

    if (!device) {
      throw new ApiError(404, "Device not found.", "DEVICE_NOT_FOUND");
    }

    where.deviceId = device.id;
  }

  const [media, total] = await prisma.$transaction([
    prisma.media.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        device: { select: { id: true, name: true, platform: true } },
      },
    }),
    prisma.media.count({ where }),
  ]);

  return sendSuccess(res, media, {
    meta: buildPaginationMeta(total, page, limit),
  });
}

async function getMedia(req, res) {
  const media = await prisma.media.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    include: {
      device: { select: { id: true, name: true, platform: true } },
    },
  });

  if (!media) {
    throw new ApiError(404, "Media not found.", "MEDIA_NOT_FOUND");
  }

  return sendSuccess(res, media);
}

async function deleteMedia(req, res) {
  const media = await prisma.media.findFirst({
    where: { id: req.params.id, userId: req.user.id },
  });

  if (!media) {
    throw new ApiError(404, "Media not found.", "MEDIA_NOT_FOUND");
  }

  await deleteMediaRecord(media);

  return sendSuccess(res, { id: media.id, deleted: true });
}

module.exports = { uploadMedia, listMedia, getMedia, deleteMedia };
