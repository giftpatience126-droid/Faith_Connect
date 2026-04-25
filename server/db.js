const mongoose = require("mongoose");

let cachedConnection = null;
let databaseStatus = {
  connected: false,
  message: "Database connection has not been attempted yet."
};

async function connectToDatabase() {
  if (cachedConnection) {
    return cachedConnection;
  }

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    databaseStatus = {
      connected: false,
      message: "MONGO_URI is not set."
    };
    return null;
  }

  try {
    // Add connection options for Vercel serverless
    const options = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000, // 5 seconds timeout
      socketTimeoutMS: 45000, // 45 seconds timeout
      maxPoolSize: 1, // Limit connections for serverless
      connectTimeoutMS: 10000, // 10 seconds connect timeout
    };

    cachedConnection = await mongoose.connect(mongoUri, options);

    databaseStatus = {
      connected: true,
      message: "Connected to MongoDB."
    };

    return cachedConnection;
  } catch (error) {
    console.error("Database connection error:", error);
    cachedConnection = null;
    databaseStatus = {
      connected: false,
      message: `Database connection failed: ${error.message}`
    };
    return null;
  }
}

function getDatabaseStatus() {
  return databaseStatus;
}

module.exports = {
  connectToDatabase,
  getDatabaseStatus
};
