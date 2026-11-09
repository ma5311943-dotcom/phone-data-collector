const jwt = require("jsonwebtoken");
const config = require("../config/env");
const prisma = require("../config/prisma");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");

const authenticate = asyncHandler(async (req, res, next) => {
  if (config.placeholders.includes("MYSQL_URL")) {
    throw new ApiError(
      503,
      "MySQL is not configured. Replace the dummy MYSQL_URL in .env with real credentials.",
      "MYSQL_NOT_CONFIGURED",
    );
  }

  const authorization = req.headers.authorization;

  if (!authorization || !/^Bearer\s+/i.test(authorization)) {
    throw new ApiError(
      401,
      "Authentication required. Send a Bearer token.",
      "AUTH_REQUIRED",
    );
  }

  const token = authorization.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    throw new ApiError(
      401,
      "Authentication required. Send a Bearer token.",
      "AUTH_REQUIRED",
    );
  }

  let payload;

  try {
    payload = jwt.verify(token, config.jwt.secret);
  } catch (error) {
    const expired = error.name === "TokenExpiredError";

    throw new ApiError(
      401,
      expired
        ? "Your session has expired. Please sign in again."
        : "Invalid authentication token.",
      expired ? "TOKEN_EXPIRED" : "INVALID_TOKEN",
    );
  }

  const userId =
    payload && typeof payload === "object" ? payload.sub : undefined;

  if (!userId) {
    throw new ApiError(
      401,
      "Invalid authentication token.",
      "INVALID_TOKEN",
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: String(userId) },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    throw new ApiError(
      401,
      "This account is not active.",
      "ACCOUNT_INACTIVE",
    );
  }

  req.user = user;
  req.auth = payload;
  next();
});

module.exports = { authenticate };
