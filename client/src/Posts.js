const mongoose = require("mongoose");

const postSchema = new mongoose.Schema({
  userId: String,
  content: String,
  likes: { type: Number, default: 0 }
}, { timestamps: true });


module.exports = mongoose.model("Post", postSchema);