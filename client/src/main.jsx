import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import { io } from "socket.io-client";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function getStoredSession() {
  try {
    return JSON.parse(localStorage.getItem("discordCloneSession")) || null;
  } catch {
    return null;
  }
}

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload = mode === "login" ? { email: form.email, password: form.password } : form;
      const { data } = await axios.post(`${API_URL}${endpoint}`, payload);
      localStorage.setItem("discordCloneSession", JSON.stringify(data));
      onAuth(data);
    } catch (err) {
      setError(err.response?.data?.message || "Cannot connect to the server. Check Express and MongoDB.");
    } finally {
      setLoading(false);
    }
  }

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div>
          <p className="eyebrow">Real-time chat</p>
          <h1>Discord Clone</h1>
          <p className="muted">Create an account, join channels, and chat live with Socket.io.</p>
        </div>

        <div className="mode-switch" role="tablist" aria-label="Authentication mode">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
            Log in
          </button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "register" && (
            <label>
              Username
              <input name="username" value={form.username} onChange={updateField} minLength="3" required />
            </label>
          )}
          <label>
            Email
            <input name="email" type="email" value={form.email} onChange={updateField} required />
          </label>
          <label>
            Password
            <input name="password" type="password" value={form.password} onChange={updateField} minLength="6" required />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="primary-button" disabled={loading}>
            {loading ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>
      </section>
    </main>
  );
}

function Avatar({ user }) {
  return (
    <span className="avatar" style={{ backgroundColor: user?.avatarColor || "#5865f2" }}>
      {user?.username?.charAt(0)?.toUpperCase() || "?"}
    </span>
  );
}

function ChatApp({ session, onLogout }) {
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [newChannel, setNewChannel] = useState("");
  const [status, setStatus] = useState("Connecting...");
  const bottomRef = useRef(null);

  const api = useMemo(() => {
    return axios.create({
      baseURL: API_URL,
      headers: { Authorization: `Bearer ${session.token}` }
    });
  }, [session.token]);

  const socket = useMemo(() => {
    return io(API_URL, {
      auth: { token: session.token },
      autoConnect: false
    });
  }, [session.token]);

  useEffect(() => {
    async function loadChannels() {
      const { data } = await api.get("/api/channels");
      setChannels(data);
      setActiveChannel(data[0] || null);
    }

    loadChannels().catch(() => setStatus("Could not load channels"));
  }, [api]);

  useEffect(() => {
    socket.connect();

    socket.on("connect", () => setStatus("Online"));
    socket.on("disconnect", () => setStatus("Offline"));
    socket.on("connect_error", () => setStatus("Connection error"));
    socket.on("newMessage", (message) => {
      setMessages((current) => {
        if (message.channel !== activeChannel?._id) return current;
        if (current.some((item) => item._id === message._id)) return current;
        return [...current, message];
      });
    });

    return () => {
      socket.disconnect();
      socket.removeAllListeners();
    };
  }, [socket, activeChannel?._id]);

  useEffect(() => {
    if (!activeChannel) return;

    socket.emit("joinChannel", activeChannel._id);
    api.get(`/api/messages/${activeChannel._id}`).then(({ data }) => setMessages(data));
  }, [activeChannel, api, socket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function sendMessage(event) {
    event.preventDefault();
    const text = messageText.trim();
    if (!text || !activeChannel) return;

    socket.emit("sendMessage", { channelId: activeChannel._id, text });
    setMessageText("");
  }

  async function createChannel(event) {
    event.preventDefault();
    const name = newChannel.trim();
    if (!name) return;

    const { data } = await api.post("/api/channels", { name });
    setChannels((current) => [...current, data]);
    setActiveChannel(data);
    setNewChannel("");
  }

  return (
    <main className="app-shell">
      <aside className="server-rail">
        <div className="server-logo">D</div>
      </aside>

      <aside className="channel-sidebar">
        <div className="sidebar-header">
          <strong>Study Server</strong>
          <span>{status}</span>
        </div>

        <div className="channel-list">
          <p className="section-title">Text channels</p>
          {channels.map((channel) => (
            <button
              key={channel._id}
              className={activeChannel?._id === channel._id ? "channel active" : "channel"}
              onClick={() => setActiveChannel(channel)}
            >
              <span>#</span>
              {channel.name}
            </button>
          ))}
        </div>

        <form className="new-channel" onSubmit={createChannel}>
          <input
            value={newChannel}
            onChange={(event) => setNewChannel(event.target.value)}
            placeholder="new-channel"
            aria-label="New channel name"
          />
          <button title="Create channel">+</button>
        </form>

        <div className="user-card">
          <Avatar user={session.user} />
          <div>
            <strong>{session.user.username}</strong>
            <span>{session.user.email}</span>
          </div>
          <button onClick={onLogout}>Log out</button>
        </div>
      </aside>

      <section className="chat-panel">
        <header className="chat-header">
          <div>
            <h2>#{activeChannel?.name || "channel"}</h2>
            <p>{activeChannel?.description || "Send a message to start the conversation."}</p>
          </div>
        </header>

        <div className="messages">
          {messages.length === 0 && <p className="empty-state">No messages yet. Say hello.</p>}
          {messages.map((message) => (
            <article className="message" key={message._id}>
              <Avatar user={message.sender} />
              <div className="message-body">
                <div className="message-meta">
                  <strong>{message.sender.username}</strong>
                  <span>{new Date(message.createdAt).toLocaleString()}</span>
                </div>
                <p>{message.text}</p>
              </div>
            </article>
          ))}
          <div ref={bottomRef} />
        </div>

        <form className="composer" onSubmit={sendMessage}>
          <input
            value={messageText}
            onChange={(event) => setMessageText(event.target.value)}
            placeholder={`Message #${activeChannel?.name || "channel"}`}
          />
          <button>Send</button>
        </form>
      </section>
    </main>
  );
}

function App() {
  const [session, setSession] = useState(getStoredSession);

  function logout() {
    localStorage.removeItem("discordCloneSession");
    setSession(null);
  }

  return session ? <ChatApp session={session} onLogout={logout} /> : <AuthScreen onAuth={setSession} />;
}

createRoot(document.getElementById("root")).render(<App />);
