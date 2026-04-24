const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  publicKey: { type: String, required: false },
  encryptedPrivateKey: { type: String, required: false },
  keySalt: { type: String, required: false },
  keyIv: { type: String, required: false },
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user"
  },
  reminderTimes: {
    type: [String],
    default: ["06:30", "12:30", "20:00"],
    validate: {
      validator: (value) => Array.isArray(value) && value.length === 3,
      message: "Three reminder times are required"
    }
  }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
