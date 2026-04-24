const express = require("express");
const cors = require("cors");

const { getDatabaseStatus } = require("./db");
const authRoutes = require("./routes/auth");
const postRoutes = require("./routes/posts");
const userRoutes = require("./routes/users");
const counselingRoutes = require("./routes/counseling");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  const dbStatus = getDatabaseStatus();
  res.status(dbStatus.connected ? 200 : 503).json({
    ok: dbStatus.connected,
    database: dbStatus
  });
});

app.use("/api", (req, res, next) => {
  if (req.path === "/health") {
    return next();
  }

  const dbStatus = getDatabaseStatus();

  if (!dbStatus.connected) {
    return res.status(503).json({
      message: dbStatus.message,
      code: "DATABASE_UNAVAILABLE"
    });
  }

  return next();
});

app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/users", userRoutes);
app.use("/api/counseling", counselingRoutes);

module.exports = app;
