const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// REGISTER
router.post("/register", async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      role = "user",
      reminderTimes = ["06:30", "12:30", "20:00"]
    } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json("User already exists");

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email,
      password: hashed,
      role,
      reminderTimes
    });

    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      reminderTimes: user.reminderTimes
    });
  } catch (err) {
    res.status(500).json(err.message);
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json("User not found");

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json("Wrong password");

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET
    );

    res.json({
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        reminderTimes: user.reminderTimes
      }
    });
  } catch (err) {
    res.status(500).json(err.message);
  }
});

router.get("/admins", async (req, res) => {
  try {
    const admins = await User.find({ role: "admin" })
      .select("_id username email role")
      .sort({ username: 1 });

    res.json(admins);
  } catch (err) {
    res.status(500).json(err.message);
  }
});

module.exports = router;
