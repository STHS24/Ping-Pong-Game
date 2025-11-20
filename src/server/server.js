// src/server/server.js

import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pino from "pino";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 8080;

// logger
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  // NOTE: in development you can run with PINO_PRETTY or use pino-pretty as a transport.
});

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
    logger.info({ score: state.score }, "Point scored (right)");
  }
  if (state.ball.x > GAME_WIDTH) {
    state.score.left++;
    resetRound();
    logger.info({ score: state.score }, "Point scored (left)");
  }

  broadcastState();
}, 1000 / 60);

function broadcastState() {
  const data = JSON.stringify({ type: "state", state });
  let clients = 0;
  wss.clients.forEach((c) => {
    if (c.readyState === 1) {
      try {
        c.send(data);
        clients++;
      } catch (err) {
        logger.warn({ err: err && err.message }, "Error sending state to client");
      }
    }
  });
  logger.debug({ clients }, "Broadcasted state");
}

// Ping/pong keepalive to detect dead peers
const PING_INTERVAL_MS = 30 * 1000;
const pingInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      logger.info({ side: ws.side }, "Terminating dead socket");
      try {
        ws.terminate();
      } catch (e) {
        logger.warn({ err: e && e.message }, "Failed to terminate socket");
      }
      return;
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch (e) {
      logger.warn({ err: e && e.message }, "Failed to ping socket");
    }
  });
}, PING_INTERVAL_MS);

wss.on("connection", (ws, req) => {
  const remoteAddr =
    req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";

  // Optional origin check (recommended)
  const allowedOrigins = process.env.ALLOWED_ORIGINS // comma separated
    ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim())
    : [];

  const origin = req.headers.origin;
  if (allowedOrigins.length > 0 && origin && !allowedOrigins.includes(origin)) {
    logger.info({ origin, remoteAddr }, "Rejected connection: origin not allowed");
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
      logger.info({ remoteAddr }, "Rejected connection: missing/invalid token");
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
  logger.info({ remoteAddr, side }, "New websocket connection");

  try {
    ws.send(JSON.stringify({ type: "side", side }));
  } catch (e) {
    logger.warn({ err: e && e.message }, "Failed to send side to client");
  }

  ws.on("message", (raw) => {
    // raw can be Buffer — protect against huge payloads (ws's maxPayload helps)
    // Defensive parsing
    try {
      // If raw is a buffer, convert to string
      const text = typeof raw === "string" ? raw : raw.toString("utf8");

      // Log message receipt at debug level (don't log full payloads in info)
      logger.debug(
        { side: ws.side, length: text.length },
        "WS message received (truncated)"
      );

      const msg = JSON.parse(text);

      if (msg.type === "move") {
        // simple per-client rate cap
        const now = Date.now();
        if (now - ws._lastMoveAt < MOVE_RATE_MS) {
          logger.trace({ side: ws.side }, "Move ignored: rate-limited");
          return;
        }
        ws._lastMoveAt = now;

        // Validate and clamp y
        const y = Number(msg.y);
        if (!Number.isFinite(y)) {
          logger.warn({ side: ws.side, raw: text }, "Invalid move payload");
          return;
        }

        const maxY = GAME_HEIGHT - PADDLE_HEIGHT;
        const clamped = Math.max(0, Math.min(maxY, Math.round(y)));

        if (ws.side === "left") state.left.y = clamped;
        if (ws.side === "right") state.right.y = clamped;

        logger.trace({ side: ws.side, y: clamped }, "Applied move");
      }
      // ignore unknown message types
    } catch (err) {
      // Bad JSON or unexpected payload -> close or ignore
      logger.warn({ err: err && err.message }, "Invalid websocket message, closing socket");
      try {
        ws.close(1003, "Invalid payload"); // 1003 = unsupported data
      } catch (e) {
        logger.warn({ err: e && e.message }, "Error closing websocket after invalid payload");
      }
    }
  });

  ws.on("close", (code, reason) => {
    logger.info(
      { side: ws.side, code, reason: reason && reason.toString() },
      "WebSocket closed"
    );
    if (ws.side === "left") players.left = null;
    if (ws.side === "right") players.right = null;
  });

  ws.on("error", (err) => {
    logger.error({ err: err && err.message, side: ws.side }, "WebSocket error");
  });
});

// Clean up ping interval on server close
server.on("close", () => {
  clearInterval(pingInterval);
});

// uncaught exception handlers so logs capture crashes
process.on("uncaughtException", (err) => {
  logger.fatal({ err: err && err.stack || err }, "Uncaught exception, exiting");
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});

// ----------------------------------------
server.listen(PORT, () => {
  logger.info({ port: PORT }, "Server running");
});