const express = require("express");
const Message = require("../models/Message");
const requireAuth = require("../middleware/auth");

const router = express.Router();

router.get("/:channelId", requireAuth, async (req, res) => {
  const messages = await Message.find({ channel: req.params.channelId })
    .populate("sender", "username avatarColor")
    .sort({ createdAt: 1 })
    .limit(100);

  res.json(messages);
});

module.exports = router;
