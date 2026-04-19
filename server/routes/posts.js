const express = require("express");
const router = express.Router();
const Post = require("../models/Post");
const User = require("../models/User");

const reactionCatalog = {
  heart: "❤️",
  pray: "🙏",
  fire: "🔥",
  celebrate: "🎉",
  support: "🤝"
};

async function resolveAuthorName(userId, isAnonymous) {
  if (!userId || isAnonymous) {
    return "Anonymous";
  }

  const user = await User.findById(userId).select("username");
  return user?.username || "Faith Friend";
}

function applyReaction(reactions, key) {
  const label = reactionCatalog[key];
  if (!label) {
    return reactions;
  }

  const existingReaction = reactions.find((reaction) => reaction.key === key);
  if (existingReaction) {
    existingReaction.count += 1;
    return reactions;
  }

  reactions.push({ key, label, count: 1 });
  return reactions;
}

router.get("/", async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json(err.message);
  }
});

router.post("/", async (req, res) => {
  try {
    const { userId, content, category = "prayer", isAnonymous = true } = req.body;
    const authorName = await resolveAuthorName(userId, isAnonymous);

    const post = await Post.create({
      userId: userId || undefined,
      content,
      category,
      isAnonymous,
      authorName
    });

    res.status(201).json(post);
  } catch (err) {
    res.status(500).json(err.message);
  }
});

router.put("/:id/like", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json("Post not found");
    }

    post.likes += 1;
    await post.save();
    res.json(post);
  } catch (err) {
    res.status(500).json(err.message);
  }
});

router.post("/:id/reactions", async (req, res) => {
  try {
    const { key } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json("Post not found");
    }

    applyReaction(post.reactions, key);
    await post.save();
    res.json(post);
  } catch (err) {
    res.status(500).json(err.message);
  }
});

router.post("/:id/comment", async (req, res) => {
  try {
    const { text, userId, isAnonymous = true } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json("Post not found");
    }

    const authorName = await resolveAuthorName(userId, isAnonymous);

    post.comments.push({
      userId: userId || undefined,
      text,
      authorName,
      isAnonymous
    });

    await post.save();
    res.json(post);
  } catch (err) {
    res.status(500).json(err.message);
  }
});

router.put("/:postId/comments/:commentId/like", async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json("Post not found");
    }

    const comment = post.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json("Comment not found");
    }

    comment.likes += 1;
    await post.save();
    res.json(post);
  } catch (err) {
    res.status(500).json(err.message);
  }
});

router.post("/:postId/comments/:commentId/reactions", async (req, res) => {
  try {
    const { key } = req.body;
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json("Post not found");
    }

    const comment = post.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json("Comment not found");
    }

    applyReaction(comment.reactions, key);
    await post.save();
    res.json(post);
  } catch (err) {
    res.status(500).json(err.message);
  }
});

module.exports = router;
