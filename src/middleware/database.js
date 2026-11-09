const config = require("../config/env");
const ApiError = require("../utils/ApiError");

function requireDatabaseConfigured(req, res, next) {
  if (config.placeholders.includes("MYSQL_URL")) {
    return next(
      new ApiError(
        503,
        "MySQL is not configured. Replace the dummy MYSQL_URL in .env with real credentials.",
        "MYSQL_NOT_CONFIGURED",
      ),
    );
  }

  return next();
}

module.exports = { requireDatabaseConfigured };
