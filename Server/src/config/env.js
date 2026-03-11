function isProduction() {
  return process.env.NODE_ENV === "production";
}

function getRequiredEnv(name) {
  const value = process.env[name];
  if (value) {
    return value;
  }

  if (isProduction()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return "";
}

function parseAllowedOrigins(value) {
  return String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getMongoUri() {
  return process.env.MONGO_URI || "mongodb://localhost/testforge";
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) {
    return secret;
  }

  if (isProduction()) {
    throw new Error("Missing required environment variable: JWT_SECRET");
  }

  return "secret";
}

function getAllowedOrigins() {
  const raw =
    process.env.CLIENT_URL ||
    process.env.CLIENT_ORIGIN ||
    process.env.CORS_ORIGIN ||
    "";

  const allowedOrigins = parseAllowedOrigins(raw);

  if (allowedOrigins.length) {
    return allowedOrigins;
  }

  if (isProduction()) {
    throw new Error(
      "Missing required environment variable: CLIENT_URL, CLIENT_ORIGIN, or CORS_ORIGIN",
    );
  }

  return [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ];
}

function getPort() {
  return Number(process.env.PORT || 4000);
}

function getTrustProxySetting() {
  const raw = process.env.TRUST_PROXY;

  if (raw === undefined || raw === null || raw === "") {
    return isProduction() ? 1 : false;
  }

  if (raw === "true") return true;
  if (raw === "false") return false;

  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : raw;
}

function getServerConfig() {
  if (isProduction()) {
    getRequiredEnv("MONGO_URI");
    getJwtSecret();
    getAllowedOrigins();
  }

  return {
    nodeEnv: process.env.NODE_ENV || "development",
    isProduction: isProduction(),
    port: getPort(),
    mongoUri: getMongoUri(),
    jwtSecret: getJwtSecret(),
    allowedOrigins: getAllowedOrigins(),
    trustProxy: getTrustProxySetting(),
  };
}

module.exports = {
  getServerConfig,
  getJwtSecret,
  getAllowedOrigins,
  getMongoUri,
};
