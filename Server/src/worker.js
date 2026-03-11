const mongoose = require("mongoose");
require("./config/loadEnv");
const { ensureRedisConnection } = require("./services/redisClient");
const { startResultWorker } = require("./services/resultQueue");

async function startWorker() {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost/testforge");
    await ensureRedisConnection();
    startResultWorker();
    console.log("Result worker is running");
  } catch (err) {
    console.error("Worker startup failed:", err);
    process.exit(1);
  }
}

startWorker();
