const multer = require("multer");
const config = require("../config/env");
const ApiError = require("../utils/ApiError");

function notFound(req, res, next) {
  next(
    new ApiError(
      404,
      `Route not found: ${req.method} ${req.originalUrl}`,
      "ROUTE_NOT_FOUND",
    ),
  );
}

function errorHandler(error, req, res, next) {
  let statusCode = 500;
  let code = "INTERNAL_ERROR";
  let message = "An unexpected error occurred.";
  let details;

  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
    details = error.details;
  } else if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      statusCode = 413;
      code = "FILE_TOO_LARGE";
      message = `File is too large. Maximum allowed size is ${Math.floor(
        config.uploads.maxFileSize / (1024 * 1024),
      )} MB.`;
      details = { maxFileSize: config.uploads.maxFileSize };
    } else if (error.code === "LIMIT_FILE_COUNT") {
      statusCode = 400;
      code = "TOO_MANY_FILES";
      message = "Only one file can be uploaded per request.";
    } else if (error.code === "LIMIT_UNEXPECTED_FILE") {
      statusCode = 400;
      code = "UNEXPECTED_FILE_FIELD";
      message = "Unexpected file field. Use the 'file' field.";
    } else {
      statusCode = 400;
      code = "UPLOAD_ERROR";
      message = error.message;
    }
  } else if (error && error.code === "P2002") {
    statusCode = 409;
    code = "DUPLICATE_RECORD";
    message = "A record with the same unique value already exists.";
    details = error.meta &&
      error.meta.target && {
        target: error.meta.target,
      };
  } else if (error && error.code === "P2025") {
    statusCode = 404;
    code = "RECORD_NOT_FOUND";
    message = "The requested record was not found.";
  } else if (error && error.code === "P2003") {
    statusCode = 409;
    code = "RELATION_CONFLICT";
    message = "This operation conflicts with related records.";
  } else if (error && error.type === "entity.parse.failed") {
    statusCode = 400;
    code = "INVALID_JSON";
    message = "The request body contains invalid JSON.";
  } else if (error && error.type === "entity.too.large") {
    statusCode = 413;
    code = "PAYLOAD_TOO_LARGE";
    message = "The request body is too large.";
  } else if (
    error &&
    (error.http_code || error.name === "CloudinaryError")
  ) {
    statusCode = 502;
    code = "CLOUDINARY_ERROR";
    message = "File storage operation failed. Please try again.";
    details = config.isProduction
      ? undefined
      : { reason: error.message };
  }

  if (statusCode >= 500) {
    const label = `[${req.method} ${req.originalUrl}]`;

    if (error && error.isOperational) {
      console.warn(`${label} ${code}: ${message}`);
    } else {
      console.error(label, error);
    }
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  });
}

module.exports = { notFound, errorHandler };
