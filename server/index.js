require("dotenv").config();
const app = require("./app");
const { connectToDatabase, getDatabaseStatus } = require("./db");

// For Vercel serverless
module.exports = async (req, res) => {
  try {
    await connectToDatabase();
    return app(req, res);
  } catch (error) {
    console.error("Serverless function error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
