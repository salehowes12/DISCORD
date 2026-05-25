require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const User = require("./models/User");
const Channel = require("./models/Channel");
const Message = require("./models/Message");
const authRoutes = require("./routes/auth");
const channelRoutes = require("./routes/channels");
const messageRoutes = require("./routes/messages");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/discord_clone";
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Discord clone API is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/channels", channelRoutes);
app.use("/api/messages", messageRoutes);

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"]
  }
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));

    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.id).select("-password");
    if (!user) return next(new Error("User not found"));

    socket.user = user;
    next();
  } catch (error) {
    next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  socket.on("joinChannel", async (channelId) => {
    const exists = await Channel.exists({ _id: channelId });
    if (!exists) return;

    socket.join(channelId);
    socket.emit("channelJoined", { channelId });
  });

  socket.on("sendMessage", async ({ channelId, text }) => {
    const cleanText = String(text || "").trim();
    if (!cleanText || !channelId) return;

    const channel = await Channel.findById(channelId);
    if (!channel) return;

    const message = await Message.create({
      text: cleanText,
      channel: channelId,
      sender: socket.user._id
    });

    const populatedMessage = await message.populate("sender", "username avatarColor");
    io.to(channelId).emit("newMessage", populatedMessage);
  });
});

async function seedChannels() {
  const defaults = [
    { name: "general", description: "Main room for everyone" },
    { name: "study", description: "Questions, notes, and project talk" },
    { name: "random", description: "Casual conversations" }
  ];

  for (const channel of defaults) {
    await Channel.updateOne({ name: channel.name }, { $setOnInsert: channel }, { upsert: true });
  }
}

async function start() {
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    await seedChannels();
    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

start();
