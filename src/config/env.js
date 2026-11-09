const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
  quiet: true,
});

function readEnv(name, { required = true, fallback = undefined } = {}) {
  const value = process.env[name];

  if (required && (value === undefined || value === "")) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value === undefined || value === "" ? fallback : value;
}

const nodeEnv = String(readEnv("NODE_ENV", { fallback: "development" })).trim();

const port = Number.parseInt(readEnv("PORT", { fallback: "5000" }), 10);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a valid TCP port number.");
}

const maxFileSize = Number.parseInt(readEnv("MAX_FILE_SIZE"), 10);

if (!Number.isInteger(maxFileSize) || maxFileSize <= 0) {
  throw new Error("MAX_FILE_SIZE must be a positive integer in bytes.");
}

if (maxFileSize > 2147483647) {
  throw new Error("MAX_FILE_SIZE must not exceed 2147483647 bytes.");
}

const mysqlUrl = readEnv("MYSQL_URL");
const jwtSecret = readEnv("JWT_SECRET");
const cloudinaryCloudName = readEnv("CLOUDINARY_CLOUD_NAME");
const cloudinaryApiKey = readEnv("CLOUDINARY_API_KEY");
const cloudinaryApiSecret = readEnv("CLOUDINARY_API_SECRET");

const config = {
  nodeEnv,
  isProduction: nodeEnv === "production",
  port,
  mysqlUrl,
  jwt: {
    secret: jwtSecret,
    expiresIn: readEnv("JWT_EXPIRES_IN", { fallback: "7d" }),
  },
  cloudinary: {
    cloudName: cloudinaryCloudName,
    apiKey: cloudinaryApiKey,
    apiSecret: cloudinaryApiSecret,
    folders: {
      assignments: "assignments",
      images: "images",
      videos: "videos",
      documents: "documents",
    },
  },
  uploads: {
    maxFileSize,
  },
};

const placeholderRules = {
  MYSQL_URL: (value) => /dummy/i.test(value),
  JWT_SECRET: (value) => /^replace_with_/i.test(value),
  CLOUDINARY_CLOUD_NAME: (value) => /^dummy_/i.test(value),
  CLOUDINARY_API_KEY: (value) => /^dummy_/i.test(value),
  CLOUDINARY_API_SECRET: (value) => /^dummy_/i.test(value),
};

const envValues = {
  MYSQL_URL: config.mysqlUrl,
  JWT_SECRET: config.jwt.secret,
  CLOUDINARY_CLOUD_NAME: config.cloudinary.cloudName,
  CLOUDINARY_API_KEY: config.cloudinary.apiKey,
  CLOUDINARY_API_SECRET: config.cloudinary.apiSecret,
};

config.placeholders = Object.keys(placeholderRules).filter((name) =>
  placeholderRules[name](envValues[name]),
);

module.exports = Object.freeze(config);
