const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { createToken, requireAuth } = require("../middleware/auth");

const router = express.Router();

const sanitizeUser = (user, includeCrypto = false) => ({
  _id: user._id,
  username: user.username,
  email: user.email,
  role: user.role,
  reminderTimes: user.reminderTimes,
  publicKey: user.publicKey,
  ...(includeCrypto
    ? {
        encryptedPrivateKey: user.encryptedPrivateKey,
        keySalt: user.keySalt,
        keyIv: user.keyIv
      }
    : {})
});

router.post("/register", async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      role,
      reminderTimes,
      publicKey,
      encryptedPrivateKey,
      keySalt,
      keyIv
    } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedUsername = String(username || "").trim();

    if (!normalizedUsername || !normalizedEmail || !password) {
      return res.status(400).send("Username, email, and password are required.");
    }
    if (!publicKey || !encryptedPrivateKey || !keySalt || !keyIv) {
      return res.status(400).send("Secure messaging keys are required.");
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).send("An account with this email already exists.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const createdUser = await User.create({
      username: normalizedUsername,
      email: normalizedEmail,
      password: hashedPassword,
      role: role === "admin" ? "admin" : "user",
      reminderTimes: Array.isArray(reminderTimes) ? reminderTimes : undefined,
      publicKey,
      encryptedPrivateKey,
      keySalt,
      keyIv
    });

    const token = createToken(createdUser);
    return res.status(201).json({
      token,
      user: sanitizeUser(createdUser, true)
    });
  } catch (error) {
    return res.status(500).send("Could not create account.");
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail || !password) {
      return res.status(400).send("Email and password are required.");
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(400).send("Invalid email or password.");
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).send("Invalid email or password.");
    }

    const token = createToken(user);
    const hasKeyBundle = Boolean(user.publicKey && user.encryptedPrivateKey && user.keySalt && user.keyIv);

    return res.json({
      token,
      user: sanitizeUser(user, hasKeyBundle),
      needsKeySetup: !hasKeyBundle
    });
  } catch (error) {
    return res.status(500).send("Could not log in.");
  }
});

router.get("/admins", async (_req, res) => {
  try {
    const admins = await User.find({ role: "admin" }).select(
      "_id username email role reminderTimes publicKey"
    );
    return res.json(admins);
  } catch (error) {
    return res.status(500).send("Could not fetch admins.");
  }
});

router.put("/keys", requireAuth, async (req, res) => {
  try {
    const { publicKey, encryptedPrivateKey, keySalt, keyIv } = req.body;

    if (!publicKey || !encryptedPrivateKey || !keySalt || !keyIv) {
      return res.status(400).send("A full secure messaging key bundle is required.");
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        publicKey,
        encryptedPrivateKey,
        keySalt,
        keyIv
      },
      { new: true, runValidators: true }
    );

    return res.json({
      token: createToken(updatedUser),
      user: sanitizeUser(updatedUser, true)
    });
  } catch (error) {
    return res.status(500).send("Could not save secure messaging keys.");
  }
});

module.exports = router;
