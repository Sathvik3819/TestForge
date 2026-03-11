const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
require("./config/loadEnv");
const { getServerConfig } = require("./config/env");

const { ensureRedisConnection } = require("./services/redisClient");
const { startResultWorker } = require("./services/resultQueue");
const { registerSocketHandlers } = require("./services/socketService");
const { createRateLimiter } = require("./middleware/rateLimit");

const config = getServerConfig();
const app = express();
app.set("trust proxy", config.trustProxy);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS origin not allowed"));
    },
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(
  createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 200,
  }),
);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: config.allowedOrigins,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
  },
});

// mount routes
const authRouter = require("./routes/auth");
const examRouter = require("./routes/exam");
const groupsRouter = require("./routes/groups");

app.use("/api/auth", authRouter);
app.use("/api/exams", examRouter);
app.use("/api/groups", groupsRouter);

app.get("/", (req, res) => {
  res.send("TestForge backend is running");
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    env: config.nodeEnv,
    uptime: process.uptime(),
  });
});

registerSocketHandlers(io);

async function start() {
  try {
    await mongoose.connect(config.mongoUri);
    console.log("mongodb connected");
    try {
      await ensureRedisConnection();
      console.log("redis connected");
      startResultWorker();
      console.log("result worker started");
    } catch (redisErr) {
      console.warn(
        "redis unavailable, continuing without redis-backed features:",
        redisErr.message,
      );
    }

    server.listen(config.port, () => {
      console.log("Server listening on port", config.port);
    });
  } catch (err) {
    console.error("Server startup failed:", err);
    process.exit(1);
  }
}

start();
