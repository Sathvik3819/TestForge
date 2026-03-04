const { createClient } = require("redis");

let redisClient = null;

function getRedisUrl() {
  return process.env.REDIS_URL || "redis://127.0.0.1:6379";
}

function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({ url: getRedisUrl() });
    redisClient.on("error", (err) => {
      console.error("Redis error:", err.message);
    });
  }

  return redisClient;
}

async function ensureRedisConnection() {
  const client = getRedisClient();
  if (!client.isOpen) {
    await client.connect();
  }

  return client;
}

function getBullRedisOptions() {
  const url = new URL(getRedisUrl());
  const options = {
    host: url.hostname,
    port: Number(url.port || 6379),
    db: Number(url.pathname?.replace("/", "") || 0),
  };

  if (url.password) {
    options.password = decodeURIComponent(url.password);
  }

  return options;
}

module.exports = {
  getRedisClient,
  ensureRedisConnection,
  getBullRedisOptions,
};
