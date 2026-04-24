const express = require("express");
const Post = require("../models/Post");
const User = require("../models/User");

const router = express.Router();

const reactionLabels = {
  heart: "❤️",
  pray: "🙏",
  fire: "🔥",
  celebrate: "🎉",
  support: "🤝"
};

const addReaction = (list, key) => {
  const index = list.findIndex((item) => item.key === key);
  if (index === -1) {
    list.push({ key, label: reactionLabels[key] || key, count: 1 });
    return;
  }
  list[index].count += 1;
};

router.get("/", async (_req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    return res.json(posts);
  } catch (error) {
    return res.status(500).send("Could not fetch posts.");
  }
});

router.post("/", async (req, res) => {
  try {
    const { userId, content, category, isAnonymous } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).send("Post content is required.");
    }

    const user = userId ? await User.findById(userId) : null;
    const post = await Post.create({
      userId: userId || undefined,
      content: content.trim(),
      category,
      isAnonymous: Boolean(isAnonymous),
      authorName: isAnonymous ? "Anonymous" : user?.username || "Community"
    });

    return res.status(201).json(post);
  } catch (error) {
    return res.status(500).send("Could not create post.");
  }
});

router.put("/:postId/like", async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(req.params.postId, { $inc: { likes: 1 } }, { new: true });
    if (!post) {
      return res.status(404).send("Post not found.");
    }
    return res.json(post);
  } catch (error) {
    return res.status(500).send("Could not like post.");
  }
});

router.post("/:postId/reactions", async (req, res) => {
  try {
    const { key } = req.body;
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).send("Post not found.");
    }
    if (!key) {
      return res.status(400).send("Reaction key is required.");
    }

    addReaction(post.reactions, key);
    await post.save();
    return res.json(post);
  } catch (error) {
    return res.status(500).send("Could not react to post.");
  }
});

router.post("/:postId/comment", async (req, res) => {
  try {
    const { userId, text, isAnonymous } = req.body;
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).send("Post not found.");
    }
    if (!text || !text.trim()) {
      return res.status(400).send("Comment text is required.");
    }

    const user = userId ? await User.findById(userId) : null;
    post.comments.push({
      userId: userId || undefined,
      text: text.trim(),
      isAnonymous: Boolean(isAnonymous),
      authorName: isAnonymous ? "Anonymous" : user?.username || "Community"
    });
    await post.save();
    return res.status(201).json(post);
  } catch (error) {
    return res.status(500).send("Could not create comment.");
  }
});

router.put("/:postId/comments/:commentId/like", async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).send("Post not found.");
    }
    const comment = post.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).send("Comment not found.");
    }
    comment.likes += 1;
    await post.save();
    return res.json(post);
  } catch (error) {
    return res.status(500).send("Could not like comment.");
  }
});

router.post("/:postId/comments/:commentId/reactions", async (req, res) => {
  try {
    const { key } = req.body;
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).send("Post not found.");
    }
    const comment = post.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).send("Comment not found.");
    }
    if (!key) {
      return res.status(400).send("Reaction key is required.");
    }

    addReaction(comment.reactions, key);
    await post.save();
    return res.json(post);
  } catch (error) {
    return res.status(500).send("Could not react to comment.");
  }
});

module.exports = router;
