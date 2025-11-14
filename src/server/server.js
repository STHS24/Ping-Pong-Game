// src/server/server.js

import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 8080;

// ----------------------------------------
// EXPRESS HTTP SERVER (serves the frontend)
// ----------------------------------------
const app = express();

// FRONTEND ROOT = TWO FOLDERS UP
// Because server.js is inside /src/server/
const FRONTEND_DIR = join(__dirname, "..", "..");

// Serve everything (index.html, src/, styles/, etc)
app.use(express.static(FRONTEND_DIR));

// Prevent favicon 404 spam
app.get("/favicon.ico", (req, res) => res.status(204).end());

// SPA fallback (optional)
app.get("*", (req, res) => {
    res.sendFile(join(FRONTEND_DIR, "index.html"));
});

// Create HTTP server so WebSocket can share same port
const server = createServer(app);

// ----------------------------------------
// WEBSOCKET SERVER (game state sync)
// ----------------------------------------
const wss = new WebSocketServer({ server });

let players = {
    left: null,
    right: null
};

let state = {
    left: { y: 250 },
    right: { y: 250 },
    ball: { x: 400, y: 300, vx: 5, vy: 3 },
    score: { left: 0, right: 0 }
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
    state.ball = { x: 400, y: 300, vx: 5, vy: 3 };
    state.left.y = 250;
    state.right.y = 250;
}

// Physics loop (60 FPS)
setInterval(() => {
    state.ball.x += state.ball.vx;
    state.ball.y += state.ball.vy;

    if (state.ball.y <= 0 || state.ball.y >= 600)
        state.ball.vy *= -1;

    // Left paddle collision
    if (
        state.ball.x <= 42 &&
        state.ball.y >= state.left.y &&
        state.ball.y <= state.left.y + 100
    ) {
        state.ball.vx *= -1;
    }

    // Right paddle collision
    if (
        state.ball.x >= 760 &&
        state.ball.y >= state.right.y &&
        state.ball.y <= state.right.y + 100
    ) {
        state.ball.vx *= -1;
    }

    if (state.ball.x < 0) {
        state.score.right++;
        resetRound();
    }
    if (state.ball.x > 800) {
        state.score.left++;
        resetRound();
    }

    broadcastState();
}, 1000 / 60);

function broadcastState() {
    const data = JSON.stringify({ type: "state", state });
    wss.clients.forEach(c => {
        if (c.readyState === 1) c.send(data);
    });
}

wss.on("connection", ws => {
    const side = assignSide(ws);
    ws.send(JSON.stringify({ type: "side", side }));

    ws.on("message", raw => {
        const msg = JSON.parse(raw);
        if (msg.type === "move") {
            if (ws.side === "left") state.left.y = msg.y;
            if (ws.side === "right") state.right.y = msg.y;
        }
    });

    ws.on("close", () => {
        if (ws.side === "left") players.left = null;
        if (ws.side === "right") players.right = null;
    });
});

// ----------------------------------------
server.listen(PORT, () => {
    console.log("Server running on port", PORT);
});
