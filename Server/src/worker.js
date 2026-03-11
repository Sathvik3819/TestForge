const mongoose = require("mongoose");
require("./config/loadEnv");
const { getMongoUri } = require("./config/env");
const { ensureRedisConnection } = require("./services/redisClient");
const { startResultWorker } = require("./services/resultQueue");

async function startWorker() {
  try {
    await mongoose.connect(getMongoUri());
    await ensureRedisConnection();
    startResultWorker();
    console.log("Result worker is running");
  } catch (err) {
    console.error("Worker startup failed:", err);
    process.exit(1);
  }
}

startWorker();
