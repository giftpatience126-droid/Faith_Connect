require("dotenv").config();
const app = require("./app");

// For Vercel serverless - no database connection needed
module.exports = async (req, res) => {
  try {
    return app(req, res);
  } catch (error) {
    console.error("Serverless function error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
