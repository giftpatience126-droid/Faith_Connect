require("dotenv").config();
const app = require("./app");
const { connectToDatabase } = require("./db");

module.exports = async (req, res) => {
  try {
    await connectToDatabase();
    return app(req, res);
  } catch (error) {
    return res.status(500).json({ error: "Database connection failed." });
  }
};
