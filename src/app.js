const express = require("express");
const cors = require("cors");
const config = require("./config/env");
const routes = require("./routes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: false, limit: "5mb" }));
app.use((req, res, next) => {
  if (req.body === undefined || req.body === null) {
    req.body = {};
  }

  next();
});

app.get("/api/health", (req, res) => {
  const databaseConfigured = !config.placeholders.includes("MYSQL_URL");
  const cloudinaryConfigured = !config.placeholders.some((name) =>
    name.startsWith("CLOUDINARY_"),
  );
  const authConfigured = !config.placeholders.includes("JWT_SECRET");

  res.json({
    success: true,
    data: {
      status: "ok",
      environment: config.nodeEnv,
      uptimeSeconds: Math.round(process.uptime()),
      database: {
        configured: databaseConfigured,
        verified: false,
        checkCommand: "npm run db:check",
      },
      cloudinary: {
        configured: cloudinaryConfigured,
        verified: false,
        checkCommand: "npm run db:check",
      },
      auth: {
        configured: authConfigured,
      },
      pendingConfiguration: config.placeholders,
    },
  });
});

app.use("/api", routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
