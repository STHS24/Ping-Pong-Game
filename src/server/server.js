// src/server/server.js

import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 8080;

// Game constants
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const PADDLE_HEIGHT = 100;
const MOVE_RATE_MS = 1000 / 60; // accept moves up to 60 Hz

// ----------------------------------------
// EXPRESS HTTP SERVER (serves the frontend)
// ----------------------------------------
const app = express();

// Basic hardening
app.disable("x-powered-by");
app.use(helmet());

// HTTP rate limiter (adjust to suit)
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // max requests per IP per window
});
app.use(limiter);

// FRONTEND ROOT = TWO FOLDERS UP
const FRONTEND_DIR = join(__dirname, "..", "..");

// Serve everything (index.html, src/, styles/, etc)
app.use(express.static(FRONTEND_DIR));

// Prevent favicon 404 spam
app.get("/favicon.ico", (req, res) => res.status(204).end());

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(join(FRONTEND_DIR, "index.html"));
});

// Create HTTP server so WebSocket can share same port
const server = createServer(app);

// ----------------------------------------
// WEBSOCKET SERVER (game state sync)
// ----------------------------------------
// Set a reasonable maxPayload (bytes) to reduce abuse
const MAX_PAYLOAD_BYTES = 1024 * 8; // 8 KB

const wss = new WebSocketServer({
  server,
  maxPayload: MAX_PAYLOAD_BYTES,
});

let players = {
  left: null,
  right: null,
};

let state = {
  left: { y: 250 },
  right: { y: 250 },
  ball: { x: 400, y: 300, vx: 5, vy: 3 },
  score: { left: 0, right: 0 },
};

function assignSide(ws) {
  if (!players.left) {
    players.left = ws;
    ws.side = "left";
    return "left";
  }
  if (!players.right) {
    players.right = ws;
    ws.side = "right";
    return "right";
  }
  ws.side = "spectator";
  return "spectator";
}

function resetRound() {
  state.ball = { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, vx: 5, vy: 3 };
  state.left.y = (GAME_HEIGHT - PADDLE_HEIGHT) / 2;
  state.right.y = (GAME_HEIGHT - PADDLE_HEIGHT) / 2;
}

// Physics loop (60 FPS)
setInterval(() => {
  state.ball.x += state.ball.vx;
  state.ball.y += state.ball.vy;

  if (state.ball.y <= 0 || state.ball.y >= GAME_HEIGHT) state.ball.vy *= -1;

  // Left paddle collision
  if (
    state.ball.x <= 42 &&
    state.ball.y >= state.left.y &&
    state.ball.y <= state.left.y + PADDLE_HEIGHT
  ) {
    state.ball.vx *= -1;
  }

  // Right paddle collision
  if (
    state.ball.x >= GAME_WIDTH - 40 &&
    state.ball.y >= state.right.y &&
    state.ball.y <= state.right.y + PADDLE_HEIGHT
  ) {
    state.ball.vx *= -1;
  }

  if (state.ball.x < 0) {
    state.score.right++;
    resetRound();
  }
  if (state.ball.x > GAME_WIDTH) {
    state.score.left++;
    resetRound();
  }

  broadcastState();
}, 1000 / 60);

function broadcastState() {
  // Small optimization: stringify once
  const data = JSON.stringify({ type: "state", state });
  wss.clients.forEach((c) => {
    if (c.readyState === 1) c.send(data);
  });
}

// Ping/pong keepalive to detect dead peers
const PING_INTERVAL_MS = 30 * 1000;
const pingInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      try {
        ws.terminate();
      } catch (e) {}
      return;
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch (e) {}
  });
}, PING_INTERVAL_MS);

wss.on("connection", (ws, req) => {
  // Optional origin check (recommended)
  const allowedOrigins = process.env.ALLOWED_ORIGINS // comma separated
    ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim())
    : [];

  const origin = req.headers.origin;
  if (allowedOrigins.length > 0 && origin && !allowedOrigins.includes(origin)) {
    // 1008 = Policy Violation
    ws.close(1008, "Origin not allowed");
    return;
  }

  // Optional simple token authentication
  // If WS_TOKEN is set, require the client to pass it as a query param ?token=...
  if (process.env.WS_TOKEN) {
    const url = new URL(req.url, "http://localhost");
    const token = url.searchParams.get("token");
    if (!token || token !== process.env.WS_TOKEN) {
      ws.close(4003, "Unauthorized");
      return;
    }
  }

  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  // Per-socket simple rate limiting for move messages
  ws._lastMoveAt = 0;

  const side = assignSide(ws);
  try {
    ws.send(JSON.stringify({ type: "side", side }));
  } catch (e) {}

  ws.on("message", (raw) => {
    // raw can be Buffer — protect against huge payloads (ws's maxPayload helps)
    // Defensive parsing
    try {
      // If raw is a buffer, convert to string
      const text = typeof raw === "string" ? raw : raw.toString("utf8");
      const msg = JSON.parse(text);

      if (msg.type === "move") {
        // simple per-client rate cap
        const now = Date.now();
        if (now - ws._lastMoveAt < MOVE_RATE_MS) return;
        ws._lastMoveAt = now;

        // Validate and clamp y
        const y = Number(msg.y);
        if (!Number.isFinite(y)) return;

        const maxY = GAME_HEIGHT - PADDLE_HEIGHT;
        const clamped = Math.max(0, Math.min(maxY, Math.round(y)));

        if (ws.side === "left") state.left.y = clamped;
        if (ws.side === "right") state.right.y = clamped;
      }
      // ignore unknown message types
    } catch (err) {
      // Bad JSON or unexpected payload -> close or ignore
      console.warn("Invalid websocket message, closing socket:", err && err.message);
      try {
        ws.close(1003, "Invalid payload"); // 1003 = unsupported data
      } catch (e) {}
    }
  });

  ws.on("close", () => {
    if (ws.side === "left") players.left = null;
    if (ws.side === "right") players.right = null;
  });
});

// Clean up ping interval on server close
server.on("close", () => {
  clearInterval(pingInterval);
});

// ----------------------------------------
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});