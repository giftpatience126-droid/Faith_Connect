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
    cachedConnection = await mongoose.connect(mongoUri, {
      bufferCommands: false
    });

    databaseStatus = {
      connected: true,
      message: "Connected to MongoDB."
    };

    return cachedConnection;
  } catch (error) {
    cachedConnection = null;
    databaseStatus = {
      connected: false,
      message:
        "MongoDB is currently unreachable. Check your Atlas IP whitelist, cluster status, and connection string."
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
