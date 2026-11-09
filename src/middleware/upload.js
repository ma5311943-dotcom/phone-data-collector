const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const config = require("../config/env");
const { cloudinary } = require("../config/cloudinary");
const ApiError = require("../utils/ApiError");
const { MIME_INFO } = require("../utils/fileMetadata");

const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-m4v",
  "video/3gpp",
];
const MEDIA_TYPES = [...IMAGE_TYPES, ...VIDEO_TYPES];
const DOCUMENT_TYPES = [...IMAGE_TYPES, "application/pdf"];

const IMAGE_TRANSFORMATION = [
  { width: 1600, height: 1600, crop: "limit", quality: "auto:good" },
];

const VIDEO_TRANSFORMATION = [
  { width: 1280, height: 1280, crop: "limit", quality: "auto" },
];

function buildTransformation(resourceType) {
  if (resourceType === "IMAGE") {
    return IMAGE_TRANSFORMATION;
  }

  if (resourceType === "VIDEO") {
    return VIDEO_TRANSFORMATION;
  }

  return undefined;
}

function sanitizeBaseName(originalName) {
  const baseName = path.basename(
    originalName || "file",
    path.extname(originalName || ""),
  );

  return (
    baseName
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60) || "file"
  );
}

function buildPublicId(file) {
  const randomPart = crypto.randomBytes(8).toString("hex");
  return `${Date.now()}-${randomPart}-${sanitizeBaseName(file.originalname)}`;
}

function createCloudinaryUpload({ folder, allowedMimeTypes }) {
  const allowedFormats = [
    ...new Set(
      allowedMimeTypes.map((mimeType) => MIME_INFO[mimeType].format),
    ),
  ];

  const storage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
      const mimeType = String(file.mimetype || "").toLowerCase();
      const info = MIME_INFO[mimeType];

      if (!info || !allowedMimeTypes.includes(mimeType)) {
        throw new ApiError(
          400,
          `Unsupported file type. Allowed types: ${allowedMimeTypes.join(", ")}.`,
          "UNSUPPORTED_FILE_TYPE",
        );
      }

      const uploadFolder =
        typeof folder === "function" ? folder(file) : folder;

      const params = {
        folder: uploadFolder,
        resource_type: info.resourceType.toLowerCase(),
        public_id: buildPublicId(file),
        format: info.format,
      };

      if (info.resourceType !== "RAW") {
        params.allowed_formats = allowedFormats;
        params.transformation = buildTransformation(info.resourceType);
      }

      return params;
    },
  });

  return multer({
    storage,
    limits: {
      fileSize: config.uploads.maxFileSize,
      files: 1,
      fields: 20,
      parts: 30,
    },
    fileFilter: (req, file, callback) => {
      const mimeType = String(file.mimetype || "").toLowerCase();

      if (!allowedMimeTypes.includes(mimeType)) {
        return callback(
          new ApiError(
            400,
            `Unsupported file type. Allowed types: ${allowedMimeTypes.join(", ")}.`,
            "UNSUPPORTED_FILE_TYPE",
            { allowedMimeTypes },
          ),
        );
      }

      return callback(null, true);
    },
  });
}

const documentUpload = createCloudinaryUpload({
  folder: config.cloudinary.folders.documents,
  allowedMimeTypes: DOCUMENT_TYPES,
});

const assignmentUpload = createCloudinaryUpload({
  folder: config.cloudinary.folders.assignments,
  allowedMimeTypes: DOCUMENT_TYPES,
});

const mediaUpload = createCloudinaryUpload({
  folder: (file) =>
    VIDEO_TYPES.includes(String(file.mimetype).toLowerCase())
      ? config.cloudinary.folders.videos
      : config.cloudinary.folders.images,
  allowedMimeTypes: MEDIA_TYPES,
});

module.exports = {
  documentUpload,
  assignmentUpload,
  mediaUpload,
  IMAGE_TYPES,
  VIDEO_TYPES,
  MEDIA_TYPES,
  DOCUMENT_TYPES,
};
