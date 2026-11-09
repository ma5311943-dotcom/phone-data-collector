const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const { deleteCloudinaryAsset } = require("../config/cloudinary");
const { buildFileRecord } = require("../utils/fileMetadata");

async function createDocumentFromUpload({
  file,
  userId,
  deviceId = null,
  assignmentId = null,
}) {
  if (!file) {
    throw new ApiError(
      400,
      "No file uploaded. Send multipart/form-data with a 'file' field.",
      "FILE_REQUIRED",
    );
  }

  const record = buildFileRecord(file);

  try {
    return await prisma.document.create({
      data: {
        userId,
        deviceId,
        assignmentId,
        publicId: record.publicId,
        url: record.url,
        fileName: record.fileName,
        fileType: record.fileType,
        fileSize: record.fileSize,
        resourceType: record.resourceType,
        format: record.format,
      },
    });
  } catch (error) {
    await deleteCloudinaryAsset(
      record.publicId,
      record.resourceType,
    ).catch(() => {});
    throw error;
  }
}

async function createMediaFromUpload({ file, userId, deviceId = null }) {
  if (!file) {
    throw new ApiError(
      400,
      "No file uploaded. Send multipart/form-data with a 'file' field.",
      "FILE_REQUIRED",
    );
  }

  const record = buildFileRecord(file);

  if (!record.mediaType) {
    throw new ApiError(
      400,
      "Only images and MP4 videos can be stored as media.",
      "UNSUPPORTED_MEDIA_TYPE",
    );
  }

  try {
    return await prisma.media.create({
      data: {
        userId,
        deviceId,
        publicId: record.publicId,
        url: record.url,
        fileName: record.fileName,
        fileType: record.fileType,
        fileSize: record.fileSize,
        mediaType: record.mediaType,
        format: record.format,
      },
    });
  } catch (error) {
    await deleteCloudinaryAsset(
      record.publicId,
      record.resourceType,
    ).catch(() => {});
    throw error;
  }
}

async function deleteDocumentRecord(document) {
  await deleteCloudinaryAsset(document.publicId, document.resourceType);
  await prisma.document.delete({ where: { id: document.id } });
}

async function deleteMediaRecord(media) {
  await deleteCloudinaryAsset(
    media.publicId,
    media.mediaType === "VIDEO" ? "VIDEO" : "IMAGE",
  );
  await prisma.media.delete({ where: { id: media.id } });
}

async function deleteDocumentFiles(documents) {
  await Promise.all(
    documents.map((document) =>
      deleteCloudinaryAsset(document.publicId, document.resourceType),
    ),
  );
}

async function discardUploadedFile(file) {
  if (!file) {
    return;
  }

  try {
    const record = buildFileRecord(file);
    await deleteCloudinaryAsset(record.publicId, record.resourceType);
  } catch (error) {
    return;
  }
}

module.exports = {
  createDocumentFromUpload,
  createMediaFromUpload,
  deleteDocumentRecord,
  deleteMediaRecord,
  deleteDocumentFiles,
  discardUploadedFile,
};
