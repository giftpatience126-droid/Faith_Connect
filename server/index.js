require("dotenv").config();
const app = require("./app");
const { connectToDatabase, getDatabaseStatus } = require("./db");

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
