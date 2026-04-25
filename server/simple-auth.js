const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Simple in-memory user storage for testing/backup
// In production, you'd use a proper database
let users = [];

const sanitizeUser = (user) => ({
  _id: user._id,
  username: user.username,
  email: user.email,
  role: user.role,
  reminderTimes: user.reminderTimes || ["06:30", "12:30", "20:00"]
});

// Simple token creation
function createToken(user) {
  return jwt.sign(
    { userId: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET || "fallback-secret",
    { expiresIn: "7d" }
  );
}

// Registration handler
async function handleRegister(req, res) {
  try {
    console.log("Simple auth register attempt");
    const { username, email, password, role = "user" } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: "Username, email, and password are required." });
    }

    // Check if user exists
    const existingUser = users.find(u => u.email === email.toLowerCase());
    if (existingUser) {
      return res.status(400).json({ error: "An account with this email already exists." });
    }

    // Create user
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      _id: Date.now().toString(),
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: role === "admin" ? "admin" : "user",
      reminderTimes: ["06:30", "12:30", "20:00"],
      createdAt: new Date()
    };

    users.push(newUser);
    const token = createToken(newUser);

    console.log("Simple auth user created successfully");
    return res.status(201).json({
      token,
      user: sanitizeUser(newUser)
    });
  } catch (error) {
    console.error("Simple auth register error:", error);
    return res.status(500).json({ error: "Could not create account." });
  }
}

// Login handler
async function handleLogin(req, res) {
  try {
    console.log("Simple auth login attempt");
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
    console.log("Simple auth login successful");
    return res.json({
      token,
      user: sanitizeUser(user),
      needsKeySetup: true // Always true for simple auth
    });
  } catch (error) {
    console.error("Simple auth login error:", error);
    return res.status(500).json({ error: "Could not log in." });
  }
}

module.exports = {
  handleRegister,
  handleLogin,
  createToken,
  sanitizeUser
};
