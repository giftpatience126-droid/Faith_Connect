require("dotenv").config();
const app = require("./app");
const { connectToDatabase, getDatabaseStatus } = require("./db");

// Handle both serverless and traditional server environments
async function handler(req, res) {
  try {
    await connectToDatabase();
    return app(req, res);
  } catch (error) {
    console.error("Serverless function error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// For Vercel serverless
if (process.env.NODE_ENV === 'production' && process.env.VERCEL) {
  module.exports = handler;
} else {
  // For local development
  async function startServer() {
    try {
      await connectToDatabase();
      const port = process.env.PORT || 5000;
      app.listen(port, () => {
        console.log(`Server running on port ${port}`);
        const dbStatus = getDatabaseStatus();
        console.log(
          dbStatus.connected
            ? "Database status: connected."
            : `Database status: unavailable. ${dbStatus.message}`
        );
      });
    } catch (error) {
      console.error("Failed to start server", error);
      process.exit(1);
    }
  }

  startServer();
}
