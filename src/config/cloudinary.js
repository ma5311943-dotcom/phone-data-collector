const { v2: cloudinary } = require("cloudinary");
const config = require("./env");
const ApiError = require("../utils/ApiError");

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
  secure: true,
});

const CLOUDINARY_ENV_KEYS = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

function hasCloudinaryPlaceholders() {
  return CLOUDINARY_ENV_KEYS.some((key) => config.placeholders.includes(key));
}

function ensureCloudinaryConfigured(req, res, next) {
  if (hasCloudinaryPlaceholders()) {
    return next(
      new ApiError(
        503,
        "Cloudinary is not configured. Replace the dummy CLOUDINARY_* values in .env with real credentials.",
        "CLOUDINARY_NOT_CONFIGURED",
      ),
    );
  }

  return next();
}

async function deleteCloudinaryAsset(publicId, resourceType = "image") {
  if (hasCloudinaryPlaceholders()) {
    throw new ApiError(
      503,
      "Cloudinary is not configured. Replace the dummy CLOUDINARY_* values in .env with real credentials.",
      "CLOUDINARY_NOT_CONFIGURED",
    );
  }

  if (!publicId) {
    throw new ApiError(
      400,
      "A Cloudinary public ID is required to delete a file.",
      "CLOUDINARY_PUBLIC_ID_REQUIRED",
    );
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: String(resourceType).toLowerCase(),
      invalidate: true,
    });

    if (result.result !== "ok" && result.result !== "not found") {
      throw new Error(`Unexpected Cloudinary deletion result: ${result.result}`);
    }

    return result;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      502,
      "File storage could not delete the file. Please try again.",
      "CLOUDINARY_DELETE_FAILED",
      config.isProduction ? undefined : { reason: error.message },
    );
  }
}

module.exports = {
  cloudinary,
  hasCloudinaryPlaceholders,
  ensureCloudinaryConfigured,
  deleteCloudinaryAsset,
};
