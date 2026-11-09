const config = require("../src/config/env");
const prisma = require("../src/config/prisma");
const { cloudinary } = require("../src/config/cloudinary");

const CLOUDINARY_KEYS = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

async function main() {
  let failed = false;

  if (config.placeholders.includes("MYSQL_URL")) {
    console.log(
      "MySQL: skipped because MYSQL_URL still contains dummy credentials.",
    );
    failed = true;
  } else {
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log("MySQL: connected.");
    } catch (error) {
      console.error("MySQL: connection failed.");
      console.error(`Reason: ${error.message}`);
      failed = true;
    }
  }

  const placeholderCloudinaryKeys = CLOUDINARY_KEYS.filter((key) =>
    config.placeholders.includes(key),
  );

  if (placeholderCloudinaryKeys.length > 0) {
    console.log(
      `Cloudinary: skipped because these values are placeholders: ${placeholderCloudinaryKeys.join(
        ", ",
      )}.`,
    );
    failed = true;
  } else {
    try {
      const result = await cloudinary.api.ping();
      console.log(`Cloudinary: connected (${result.status}).`);
    } catch (error) {
      console.error("Cloudinary: connection failed.");
      console.error(`Reason: ${error.message}`);
      failed = true;
    }
  }

  await prisma.$disconnect();

  if (failed) {
    console.error(
      "Connection check did not pass. Replace the dummy values in .env, then rerun: npm run db:check",
    );
    process.exitCode = 1;
    return;
  }

  console.log("All connection checks passed.");
}

main().catch(async (error) => {
  console.error("Connection check crashed:", error);
  await prisma.$disconnect().catch(() => {});
  process.exitCode = 1;
});
