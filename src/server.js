const app = require("./app");
const config = require("./config/env");
const prisma = require("./config/prisma");
const { ensureAdmin } = require("./utils/seed");

if (config.isProduction && config.placeholders.length > 0) {
  console.error(
    `[config] Refusing to start in production with placeholder values for: ${config.placeholders.join(
      ", ",
    )}.`,
  );
  process.exit(1);
}

if (config.placeholders.length > 0) {
  console.warn(
    `[config] Placeholder values detected for: ${config.placeholders.join(
      ", ",
    )}. Replace the affected values in .env before use.`,
  );
}

const server = app.listen(config.port, () => {
  console.log(
    `[server] API listening on http://localhost:${config.port} (${config.nodeEnv}).`,
  );
  console.log(
    "[server] Database and Cloudinary connections are not tested on startup. Run: npm run db:check",
  );

  if (config.placeholders.length === 0) {
    ensureAdmin()
      .then((result) => {
        console.log(
          `[server] Admin account ready: ${result.email} (${result.created ? "created" : "existing"}).`,
        );
      })
      .catch((error) => {
        console.error("[server] Could not seed admin account:", error.message);
      });
  }
});

server.on("error", (error) => {
  console.error("[server] Failed to start:", error);
  process.exit(1);
});

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(`[server] ${signal} received. Shutting down...`);

  const forceExitTimer = setTimeout(() => {
    console.error("[server] Forced shutdown after timeout.");
    process.exit(1);
  }, 10000);

  forceExitTimer.unref();

  server.close(async (error) => {
    clearTimeout(forceExitTimer);

    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error(
        "[server] Failed to disconnect Prisma:",
        disconnectError,
      );
    }

    if (error) {
      console.error("[server] Failed to close HTTP server:", error);
      process.exit(1);
    }

    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  console.error("[process] Unhandled rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[process] Uncaught exception:", error);
  shutdown("uncaughtException");
});
