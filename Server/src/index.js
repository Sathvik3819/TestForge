const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

const { ensureRedisConnection } = require("./services/redisClient");
const { startResultWorker } = require("./services/resultQueue");
const { registerSocketHandlers } = require("./services/socketService");
const { createRateLimiter } = require("./middleware/rateLimit");

const app = express();
app.use(cors());
app.use(express.json());
app.use(
  createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 200,
  }),
);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
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

registerSocketHandlers(io);

async function start() {
  try {
    await mongoose.connect(
      process.env.MONGO_URI || "mongodb://localhost/testforge",
    );
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

    const port = process.env.PORT || 4000;
    server.listen(port, () => {
      console.log("Server listening on port", port);
    });
  } catch (err) {
    console.error("Server startup failed:", err);
    process.exit(1);
  }
}

start();
