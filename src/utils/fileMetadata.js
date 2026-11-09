const ApiError = require("./ApiError");

const MIME_INFO = Object.freeze({
  "image/jpeg": {
    resourceType: "IMAGE",
    mediaType: "IMAGE",
    format: "jpg",
  },
  "image/jpg": {
    resourceType: "IMAGE",
    mediaType: "IMAGE",
    format: "jpg",
  },
  "image/png": {
    resourceType: "IMAGE",
    mediaType: "IMAGE",
    format: "png",
  },
  "image/webp": {
    resourceType: "IMAGE",
    mediaType: "IMAGE",
    format: "webp",
  },
  "video/mp4": {
    resourceType: "VIDEO",
    mediaType: "VIDEO",
    format: "mp4",
  },
  "video/quicktime": {
    resourceType: "VIDEO",
    mediaType: "VIDEO",
    format: "mov",
  },
  "video/x-m4v": {
    resourceType: "VIDEO",
    mediaType: "VIDEO",
    format: "m4v",
  },
  "video/3gpp": {
    resourceType: "VIDEO",
    mediaType: "VIDEO",
    format: "3gp",
  },
  "application/pdf": {
    resourceType: "RAW",
    mediaType: null,
    format: "pdf",
  },
});

function getMimeInfo(mimeType) {
  const info = MIME_INFO[String(mimeType || "").toLowerCase()];

  if (!info) {
    throw new ApiError(
      400,
      "Unsupported file type.",
      "UNSUPPORTED_FILE_TYPE",
      { allowedTypes: Object.keys(MIME_INFO) },
    );
  }

  return info;
}

function buildFileRecord(file) {
  if (!file || !file.filename || !file.path) {
    throw new ApiError(
      500,
      "Uploaded file metadata is missing.",
      "UPLOAD_METADATA_MISSING",
    );
  }

  if (!Number.isInteger(file.size) || file.size < 0) {
    throw new ApiError(
      500,
      "Uploaded file size is invalid.",
      "UPLOAD_METADATA_MISSING",
    );
  }

  const info = getMimeInfo(file.mimetype);

  return {
    publicId: file.filename,
    url: file.path,
    fileName: String(file.originalname || file.filename).slice(0, 255),
    fileType: String(file.mimetype).toLowerCase(),
    fileSize: file.size,
    resourceType: info.resourceType,
    mediaType: info.mediaType,
    format: info.format,
  };
}

module.exports = { MIME_INFO, getMimeInfo, buildFileRecord };
