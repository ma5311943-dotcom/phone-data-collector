const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const { sendSuccess } = require("../utils/response");
const {
  getOwnedAssignment,
  getOptionalOwnedDevice,
} = require("../utils/ownership");
const { resolveUploadDevice } = require("../utils/uploadDevice");
const {
  createDocumentFromUpload,
  deleteDocumentRecord,
  deleteDocumentFiles,
} = require("../services/storage.service");
const {
  requireString,
  optionalString,
  requireEnum,
  optionalEnum,
  optionalDate,
  parsePagination,
  buildPaginationMeta,
  hasOwn,
} = require("../utils/validation");

const ASSIGNMENT_STATUSES = ["DRAFT", "PUBLISHED", "CLOSED"];

const ASSIGNMENT_INCLUDE = {
  documents: { orderBy: { createdAt: "desc" } },
  device: {
    select: { id: true, name: true, platform: true },
  },
  _count: { select: { documents: true } },
};

async function ensureAssignmentOwner(req, res, next) {
  req.assignment = await getOwnedAssignment(
    req.params.id,
    req.user.id,
  );
  next();
}

async function createAssignment(req, res) {
  const title = requireString(req.body.title, "title", { max: 200 });
  const description = optionalString(
    req.body.description,
    "description",
    { max: 10000 },
  );
  const status = optionalEnum(
    req.body.status,
    "status",
    ASSIGNMENT_STATUSES,
    "PUBLISHED",
  );
  const dueDate = optionalDate(req.body.dueDate, "dueDate");
  const device = await getOptionalOwnedDevice(
    req.body.deviceId,
    req.user.id,
  );

  const assignment = await prisma.assignment.create({
    data: {
      authorId: req.user.id,
      deviceId: device ? device.id : null,
      title,
      description,
      status,
      dueDate,
    },
    include: ASSIGNMENT_INCLUDE,
  });

  return sendSuccess(res, assignment, { status: 201 });
}

async function listAssignments(req, res) {
  const { page, limit, skip, take } = parsePagination(req.query);
  const where = { authorId: req.user.id };

  if (req.query.status !== undefined) {
    where.status = requireEnum(
      req.query.status,
      "status",
      ASSIGNMENT_STATUSES,
    );
  }

  if (req.query.search !== undefined) {
    where.title = {
      contains: requireString(req.query.search, "search", {
        max: 100,
      }),
    };
  }

  const [assignments, total] = await prisma.$transaction([
    prisma.assignment.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: ASSIGNMENT_INCLUDE,
    }),
    prisma.assignment.count({ where }),
  ]);

  return sendSuccess(res, assignments, {
    meta: buildPaginationMeta(total, page, limit),
  });
}

async function getAssignment(req, res) {
  return sendSuccess(res, req.assignment);
}

async function updateAssignment(req, res) {
  const assignment = req.assignment;
  const data = {};

  if (hasOwn(req.body, "title")) {
    data.title = requireString(req.body.title, "title", { max: 200 });
  }

  if (hasOwn(req.body, "description")) {
    data.description = optionalString(
      req.body.description,
      "description",
      { max: 10000 },
    );
  }

  if (hasOwn(req.body, "status")) {
    data.status = requireEnum(
      req.body.status,
      "status",
      ASSIGNMENT_STATUSES,
    );
  }

  if (hasOwn(req.body, "dueDate")) {
    data.dueDate = optionalDate(req.body.dueDate, "dueDate");
  }

  if (hasOwn(req.body, "deviceId")) {
    const device = await getOptionalOwnedDevice(
      req.body.deviceId,
      req.user.id,
    );
    data.deviceId = device ? device.id : null;
  }

  if (Object.keys(data).length === 0) {
    throw new ApiError(
      400,
      "No valid fields were provided for update.",
      "NO_UPDATE_FIELDS",
    );
  }

  const updated = await prisma.assignment.update({
    where: { id: assignment.id },
    data,
    include: ASSIGNMENT_INCLUDE,
  });

  return sendSuccess(res, updated);
}

async function deleteAssignment(req, res) {
  const assignment = req.assignment;

  if (assignment.documents.length > 0) {
    await deleteDocumentFiles(assignment.documents);
  }

  await prisma.assignment.delete({ where: { id: assignment.id } });

  return sendSuccess(res, { id: assignment.id, deleted: true });
}

async function uploadAssignmentDocument(req, res) {
  const device = await resolveUploadDevice(req, req.user.id);
  const document = await createDocumentFromUpload({
    file: req.file,
    userId: req.user.id,
    deviceId: device ? device.id : null,
    assignmentId: req.assignment.id,
  });

  return sendSuccess(res, document, { status: 201 });
}

async function deleteAssignmentDocument(req, res) {
  const document = await prisma.document.findFirst({
    where: {
      id: req.params.documentId,
      assignmentId: req.assignment.id,
      userId: req.user.id,
    },
  });

  if (!document) {
    throw new ApiError(
      404,
      "Assignment document not found.",
      "DOCUMENT_NOT_FOUND",
    );
  }

  await deleteDocumentRecord(document);

  return sendSuccess(res, { id: document.id, deleted: true });
}

module.exports = {
  ensureAssignmentOwner,
  createAssignment,
  listAssignments,
  getAssignment,
  updateAssignment,
  deleteAssignment,
  uploadAssignmentDocument,
  deleteAssignmentDocument,
};
