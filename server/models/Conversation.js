const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false
  },
  senderRole: {
    type: String,
    enum: ["user", "admin"],
    required: true
  },
  senderName: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const conversationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false
  },
  anonymous: { type: Boolean, default: false },
  subject: { type: String, required: true },
  status: {
    type: String,
    enum: ["open", "closed"],
    default: "open"
  },
  messages: {
    type: [messageSchema],
    default: []
  }
}, { timestamps: true });

module.exports = mongoose.model("Conversation", conversationSchema);
