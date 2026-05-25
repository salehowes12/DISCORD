const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const requireAuth = require("../middleware/auth");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
const colors = ["#5865f2", "#57f287", "#fee75c", "#eb459e", "#ed4245", "#00a8fc"];

function createToken(user) {
  return jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "7d" });
}

function publicUser(user) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    avatarColor: user.avatarColor
  };
}

router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const existing = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }]
    });

    if (existing) {
      return res.status(409).json({ message: "Username or email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      avatarColor: colors[Math.floor(Math.random() * colors.length)]
    });

    res.status(201).json({ token: createToken(user), user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ message: "Could not create account" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: String(email || "").toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const matches = await bcrypt.compare(password || "", user.password);
    if (!matches) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json({ token: createToken(user), user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ message: "Could not log in" });
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

module.exports = router;
