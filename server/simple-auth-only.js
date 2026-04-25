const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const router = express.Router();

// Simple in-memory storage - no database needed
let users = [];

// Generate simple token
function createToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || "simple-secret-key",
    { expiresIn: "7d" }
  );
}

// Simple registration - just create account and let them in
router.post("/register", async (req, res) => {
  try {
    console.log("Simple register request");
    const { username, email, password, role = "user" } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: "Username, email, and password are required." });
    }

    // Check if user exists
    const existingUser = users.find(u => u.email === email.toLowerCase());
    if (existingUser) {
      return res.status(400).json({ error: "An account with this email already exists." });
    }

    // Create user - no crypto keys needed
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: Date.now().toString(),
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: role,
      reminderTimes: ["06:30", "12:30", "20:00"],
      createdAt: new Date()
    };

    users.push(newUser);
    const token = createToken(newUser);

    console.log("User created successfully:", newUser.email);
    return res.status(201).json({
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        reminderTimes: newUser.reminderTimes
      }
    });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({ error: "Could not create account." });
  }
});

// Simple login
router.post("/login", async (req, res) => {
  try {
    console.log("Simple login request");
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = users.find(u => u.email === email.toLowerCase());
    if (!user) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    const token = createToken(user);
    console.log("Login successful:", user.email);
    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        reminderTimes: user.reminderTimes
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Could not log in." });
  }
});

// Health check
router.get("/health", (_req, res) => {
  res.json({ ok: true, message: "Simple auth working" });
});

module.exports = router;
