const mongoose = require("mongoose");

const reactionSchema = new mongoose.Schema({
  key: { type: String, required: true },
  label: { type: String, required: true },
  count: { type: Number, default: 0 }
}, { _id: false });

const commentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false
  },
  text: { type: String, required: true },
  authorName: { type: String, default: "Community" },
  isAnonymous: { type: Boolean, default: true },
  likes: { type: Number, default: 0 },
  reactions: {
    type: [reactionSchema],
    default: []
  },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const postSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false
  },
  authorName: String,
  content: { type: String, required: true },
  category: {
    type: String,
    enum: ["prayer", "praise", "testimony", "encouragement"],
    default: "prayer"
  },
  isAnonymous: { type: Boolean, default: true },
  likes: { type: Number, default: 0 },
  reactions: {
    type: [reactionSchema],
    default: []
  },
  comments: {
    type: [commentSchema],
    default: []
  }
}, { timestamps: true });

module.exports = mongoose.model("Post", postSchema);
