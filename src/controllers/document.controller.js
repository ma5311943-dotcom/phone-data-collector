const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const { sendSuccess } = require("../utils/response");
const { resolveUploadDevice } = require("../utils/uploadDevice");
const {
  createDocumentFromUpload,
  deleteDocumentRecord,
} = require("../services/storage.service");
const {
  requireString,
  parsePagination,
  buildPaginationMeta,
} = require("../utils/validation");

async function uploadDocument(req, res) {
  const device = await resolveUploadDevice(req, req.user.id);
  const document = await createDocumentFromUpload({
    file: req.file,
    userId: req.user.id,
    deviceId: device ? device.id : null,
  });

  return sendSuccess(res, document, { status: 201 });
}

async function listDocuments(req, res) {
  const { page, limit, skip, take } = parsePagination(req.query);
  const where = { userId: req.user.id };

  if (req.query.assignmentId !== undefined) {
    where.assignmentId = requireString(
      req.query.assignmentId,
      "assignmentId",
      { max: 64 },
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

  if (req.query.fileType !== undefined) {
    where.fileType = requireString(req.query.fileType, "fileType", {
      max: 100,
    }).toLowerCase();
  }

  const [documents, total] = await prisma.$transaction([
    prisma.document.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        assignment: { select: { id: true, title: true } },
        device: { select: { id: true, name: true, platform: true } },
      },
    }),
    prisma.document.count({ where }),
  ]);

  return sendSuccess(res, documents, {
    meta: buildPaginationMeta(total, page, limit),
  });
}

async function getDocument(req, res) {
  const document = await prisma.document.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    include: {
      assignment: { select: { id: true, title: true } },
      device: { select: { id: true, name: true, platform: true } },
    },
  });

  if (!document) {
    throw new ApiError(
      404,
      "Document not found.",
      "DOCUMENT_NOT_FOUND",
    );
  }

  return sendSuccess(res, document);
}

async function deleteDocument(req, res) {
  const document = await prisma.document.findFirst({
    where: { id: req.params.id, userId: req.user.id },
  });

  if (!document) {
    throw new ApiError(
      404,
      "Document not found.",
      "DOCUMENT_NOT_FOUND",
    );
  }

  await deleteDocumentRecord(document);

  return sendSuccess(res, { id: document.id, deleted: true });
}

module.exports = {
  uploadDocument,
  listDocuments,
  getDocument,
  deleteDocument,
};
