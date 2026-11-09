const ApiError = require("../utils/ApiError");

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "ADMIN") {
    return next(
      new ApiError(
        403,
        "Administrator access is required for this resource.",
        "ADMIN_REQUIRED",
      ),
    );
  }

  return next();
}

module.exports = { requireAdmin };
