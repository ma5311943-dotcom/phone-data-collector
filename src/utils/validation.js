const ApiError = require("./ApiError");

function fail(message, field) {
  throw new ApiError(
    400,
    message,
    "VALIDATION_ERROR",
    field ? { field } : undefined,
  );
}

function isMissing(value) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "")
  );
}

function requireString(value, field, { min = 1, max = 255 } = {}) {
  if (isMissing(value) || typeof value !== "string") {
    fail(`${field} is required.`, field);
  }

  const trimmed = value.trim();

  if (trimmed.length < min) {
    fail(`${field} must be at least ${min} character(s).`, field);
  }

  if (trimmed.length > max) {
    fail(`${field} must be at most ${max} characters.`, field);
  }

  return trimmed;
}

function optionalString(value, field, { max = 255 } = {}) {
  if (isMissing(value)) {
    return null;
  }

  if (typeof value !== "string") {
    fail(`${field} must be a string.`, field);
  }

  const trimmed = value.trim();

  if (trimmed.length > max) {
    fail(`${field} must be at most ${max} characters.`, field);
  }

  return trimmed === "" ? null : trimmed;
}

function requireEmail(value, field = "email") {
  const email = requireString(value, field, { max: 191 }).toLowerCase();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    fail(`${field} must be a valid email address.`, field);
  }

  return email;
}

function optionalEmail(value, field = "email") {
  if (isMissing(value)) {
    return null;
  }

  return requireEmail(value, field);
}

function normalizePhoneNumber(value, field = "phoneNumber") {
  const raw = requireString(value, field, { max: 30 });
  const normalized = raw.replace(/[\s().-]/g, "");

  if (!/^\+?\d{3,20}$/.test(normalized)) {
    fail(`${field} must be a valid phone number.`, field);
  }

  return normalized;
}

function requireEnum(value, field, allowedValues) {
  if (isMissing(value) || typeof value !== "string") {
    fail(`${field} is required.`, field);
  }

  const normalized = value.trim().toUpperCase();

  if (!allowedValues.includes(normalized)) {
    fail(
      `${field} must be one of: ${allowedValues.join(", ")}.`,
      field,
    );
  }

  return normalized;
}

function optionalEnum(value, field, allowedValues, fallback = null) {
  if (isMissing(value)) {
    return fallback;
  }

  return requireEnum(value, field, allowedValues);
}

function optionalBoolean(value, field, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true" || value === "1" || value === 1) {
    return true;
  }

  if (value === "false" || value === "0" || value === 0) {
    return false;
  }

  fail(`${field} must be true or false.`, field);
}

function requireDate(value, field) {
  if (isMissing(value)) {
    fail(`${field} is required.`, field);
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    fail(`${field} must be a valid date.`, field);
  }

  return date;
}

function optionalDate(value, field) {
  if (isMissing(value)) {
    return null;
  }

  return requireDate(value, field);
}

function optionalInt(value, field, { min = 0, max = 2147483647 } = {}) {
  if (isMissing(value)) {
    return min;
  }

  const number = typeof value === "number" ? value : Number(value);

  if (!Number.isInteger(number)) {
    fail(`${field} must be an integer.`, field);
  }

  if (number < min || number > max) {
    fail(`${field} must be between ${min} and ${max}.`, field);
  }

  return number;
}

function requireArray(value, field, { max = 500 } = {}) {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    fail(`${field} must be an array.`, field);
  }

  if (value.length > max) {
    fail(`${field} must contain at most ${max} items.`, field);
  }

  return value;
}

function requireObject(value, field) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    fail(`${field} must be an object.`, field);
  }

  return value;
}

function parsePagination(query) {
  const parsedPage = Number.parseInt(query.page, 10);
  const parsedLimit = Number.parseInt(query.limit, 10);

  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const limit =
    Number.isInteger(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 100)
      : 20;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
  };
}

function buildPaginationMeta(total, page, limit) {
  return {
    page,
    limit,
    total,
    totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
  };
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

module.exports = {
  requireString,
  optionalString,
  requireEmail,
  optionalEmail,
  normalizePhoneNumber,
  requireEnum,
  optionalEnum,
  optionalBoolean,
  requireDate,
  optionalDate,
  optionalInt,
  requireArray,
  requireObject,
  parsePagination,
  buildPaginationMeta,
  hasOwn,
};
