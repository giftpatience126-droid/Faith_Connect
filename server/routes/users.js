const express = require("express");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.put("/:userId/reminders", requireAuth, async (req, res) => {
  try {
    if (String(req.user._id) !== String(req.params.userId)) {
      return res.status(403).send("You can only update your own reminder times.");
    }

    const { reminderTimes } = req.body;
    if (!Array.isArray(reminderTimes) || reminderTimes.length !== 3) {
      return res.status(400).send("Exactly three reminder times are required.");
    }
    const validTime = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!reminderTimes.every((time) => validTime.test(String(time)))) {
      return res.status(400).send("Reminder times must use HH:MM format.");
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.userId,
      { reminderTimes },
      { new: true, runValidators: true }
    ).select("_id username email role reminderTimes");

    if (!updatedUser) {
      return res.status(404).send("User not found.");
    }

    return res.json(updatedUser);
  } catch (error) {
    return res.status(500).send("Could not update reminder times.");
  }
});

module.exports = router;
