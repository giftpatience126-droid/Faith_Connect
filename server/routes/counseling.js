const express = require("express");
const router = express.Router();
const Conversation = require("../models/Conversation");
const User = require("../models/User");

router.get("/", async (req, res) => {
  try {
    const { userId, adminId, role } = req.query;
    const query = {};

    if (role === "admin" && adminId) {
      query.adminId = adminId;
    } else if (userId) {
      query.userId = userId;
    }

    const conversations = await Conversation.find(query)
      .sort({ updatedAt: -1 })
      .populate("userId", "username email role")
      .populate("adminId", "username email role");

    res.json(conversations);
  } catch (err) {
    res.status(500).json(err.message);
  }
});

router.post("/", async (req, res) => {
  try {
    const { userId, adminId, anonymous = false, subject, text } = req.body;

    const user = await User.findById(userId).select("username");
    if (!user) {
      return res.status(404).json("User not found");
    }

    let chosenAdminId = adminId;
    if (!chosenAdminId) {
      const fallbackAdmin = await User.findOne({ role: "admin" }).select("_id");
      chosenAdminId = fallbackAdmin?._id;
    }

    const conversation = await Conversation.create({
      userId,
      adminId: chosenAdminId,
      anonymous,
      subject,
      messages: [
        {
          senderId: userId,
          senderRole: "user",
          senderName: anonymous ? "Anonymous" : user.username,
          text
        }
      ]
    });

    const populated = await Conversation.findById(conversation._id)
      .populate("userId", "username email role")
      .populate("adminId", "username email role");

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json(err.message);
  }
});

router.post("/:id/messages", async (req, res) => {
  try {
    const { senderId, senderRole, text } = req.body;
    const conversation = await Conversation.findById(req.params.id);

    if (!conversation) {
      return res.status(404).json("Conversation not found");
    }

    const sender = await User.findById(senderId).select("username");
    if (!sender) {
      return res.status(404).json("Sender not found");
    }

    const senderName = senderRole === "user" && conversation.anonymous
      ? "Anonymous"
      : sender.username;

    conversation.messages.push({
      senderId,
      senderRole,
      senderName,
      text
    });

    await conversation.save();

    const populated = await Conversation.findById(conversation._id)
      .populate("userId", "username email role")
      .populate("adminId", "username email role");

    res.json(populated);
  } catch (err) {
    res.status(500).json(err.message);
  }
});

module.exports = router;
