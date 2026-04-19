const express = require("express");
const router = express.Router();
const User = require("../models/User");

router.put("/:id/reminders", async (req, res) => {
  try {
    const { reminderTimes } = req.body;

    if (!Array.isArray(reminderTimes) || reminderTimes.length !== 3) {
      return res.status(400).json("Please provide exactly three reminder times");
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { reminderTimes },
      { new: true }
    ).select("_id username email role reminderTimes");

    if (!user) {
      return res.status(404).json("User not found");
    }

    res.json(user);
  } catch (err) {
    res.status(500).json(err.message);
  }
});

module.exports = router;
