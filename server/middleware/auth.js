const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { getDatabaseStatus } = require("../db");

const JWT_SECRET = process.env.JWT_SECRET || "faith-connect-default-jwt-secret-change-me";

function createToken(user) {
  return jwt.sign(
    {
      sub: String(user._id),
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

async function requireAuth(req, res, next) {
  try {
    const dbStatus = getDatabaseStatus();
    if (!dbStatus.connected) {
      return res.status(503).send(dbStatus.message);
    }

    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).send("Authentication is required.");
    }

    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.sub).select(
      "_id username email role reminderTimes publicKey encryptedPrivateKey keySalt keyIv"
    );

    if (!user) {
      return res.status(401).send("Your session is no longer valid.");
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).send("Authentication failed.");
  }
}

module.exports = {
  createToken,
  requireAuth
};
