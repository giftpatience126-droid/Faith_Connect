const express = require("express");
const Conversation = require("../models/Conversation");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const sanitizeConversationForViewer = (conversationDoc, viewer) => {
  const conversation = conversationDoc.toObject ? conversationDoc.toObject() : conversationDoc;
  const isAdminViewer = viewer.role === "admin";

  conversation.messages = (conversation.messages || []).map((message) => ({
    ...message,
    senderName:
      conversation.anonymous && isAdminViewer && message.senderRole === "user"
        ? "Anonymous User"
        : message.senderRole === "admin"
          ? conversation.adminId?.username || "Pastor"
          : conversation.anonymous
            ? "You"
            : conversation.userId?.username || "User"
  }));

  if (conversation.anonymous && isAdminViewer && conversation.userId) {
    conversation.userId.username = "Anonymous User";
  }

  return conversation;
};

async function findConversationForUser(conversationId, user) {
  return Conversation.findOne({
    _id: conversationId,
    $or: [{ userId: user._id }, { adminId: user._id }]
  })
    .populate("adminId", "username email")
    .populate("userId", "username email");
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const query = req.user.role === "admin" ? { adminId: req.user._id } : { userId: req.user._id };

    const conversations = await Conversation.find(query)
      .populate("adminId", "username email")
      .populate("userId", "username email")
      .sort({ updatedAt: -1 });

    return res.json(conversations.map((conversation) => sanitizeConversationForViewer(conversation, req.user)));
  } catch (error) {
    return res.status(500).send("Could not fetch conversations.");
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "user") {
      return res.status(403).send("Only users can start counseling conversations.");
    }

    const { adminId, anonymous, subject, text, encryptedKeys } = req.body;
    if (!adminId || !subject || !text || !encryptedKeys?.user || !encryptedKeys?.admin) {
      return res.status(400).send("Admin, subject, encrypted message, and encrypted keys are required.");
    }

    const admin = await User.findById(adminId).select("_id role publicKey username email");
    if (!admin || admin.role !== "admin" || !admin.publicKey) {
      return res.status(400).send("A valid admin with secure messaging enabled is required.");
    }
    if (!req.user.publicKey) {
      return res.status(400).send("Your account is missing secure messaging keys.");
    }

    const conversation = await Conversation.create({
      userId: req.user._id,
      adminId,
      anonymous: Boolean(anonymous),
      subject: String(subject).trim(),
      encryptedKeys: {
        user: encryptedKeys.user,
        admin: encryptedKeys.admin
      },
      messages: [
        {
          senderId: req.user._id,
          senderRole: "user",
          senderName: anonymous ? "Anonymous" : req.user.username,
          text: String(text).trim()
        }
      ]
    });

    const populated = await findConversationForUser(conversation._id, req.user);
    return res.status(201).json(sanitizeConversationForViewer(populated, req.user));
  } catch (error) {
    return res.status(500).send("Could not create conversation.");
  }
});

router.post("/:conversationId/messages", requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !String(text).trim()) {
      return res.status(400).send("Encrypted message text is required.");
    }

    const conversation = await Conversation.findOne({
      _id: req.params.conversationId,
      $or: [{ userId: req.user._id }, { adminId: req.user._id }]
    });

    if (!conversation) {
      return res.status(404).send("Conversation not found.");
    }

    const senderRole = String(conversation.adminId) === String(req.user._id) ? "admin" : "user";
    conversation.messages.push({
      senderId: req.user._id,
      senderRole,
      senderName: senderRole === "admin" ? req.user.username : conversation.anonymous ? "Anonymous" : req.user.username,
      text: String(text).trim()
    });
    await conversation.save();

    const populatedConversation = await findConversationForUser(conversation._id, req.user);
    return res.status(201).json(sanitizeConversationForViewer(populatedConversation, req.user));
  } catch (error) {
    return res.status(500).send("Could not send message.");
  }
});

module.exports = router;
