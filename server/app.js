const express = require("express");
const cors = require("cors");

// Use simple auth only - no database dependency
const simpleAuthRoutes = require("./simple-auth-only");

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Simple health check
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, message: "Simple auth server working" });
});

// Use only simple auth routes
app.use("/api/auth", simpleAuthRoutes);

// Mock posts for testing
app.get("/api/posts", (_req, res) => {
  res.json([
    {
      _id: "1",
      content: "Welcome to Faith Connect! This is a test post.",
      category: "welcome",
      authorName: "Admin",
      likes: 5,
      comments: [],
      reactions: []
    }
  ]);
});

// Mock admins for testing
app.get("/api/auth/admins", (_req, res) => {
  res.json([
    {
      _id: "admin1",
      username: "Pastor",
      email: "pastor@faithconnect.com",
      role: "admin"
    }
  ]);
});

// Mock counseling
app.get("/api/counseling", (_req, res) => {
  res.json([]);
});

// Mock user update
app.put("/api/users/:id/reminders", (req, res) => {
  res.json({ reminderTimes: req.body.reminderTimes });
});

module.exports = app;
