const express = require("express");
const Channel = require("../models/Channel");
const requireAuth = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  const channels = await Channel.find().sort({ createdAt: 1 });
  res.json(channels);
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const name = String(req.body.name || "").trim().toLowerCase().replace(/\s+/g, "-");
    const description = String(req.body.description || "").trim();

    if (!name || name.length < 3) {
      return res.status(400).json({ message: "Channel name must be at least 3 characters" });
    }

    const channel = await Channel.create({ name, description });
    res.status(201).json(channel);
  } catch (error) {
    res.status(409).json({ message: "Channel already exists or is invalid" });
  }
});

module.exports = router;
