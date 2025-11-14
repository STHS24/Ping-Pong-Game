// server/server.js  (CommonJS version)
const { WebSocketServer } = require("ws");

const wss = new WebSocketServer({ port: 8080 });

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

// 60 FPS physics
setInterval(() => {
    state.ball.x += state.ball.vx;
    state.ball.y += state.ball.vy;

    // top/bottom bounce
    if (state.ball.y <= 0 || state.ball.y >= 600)
        state.ball.vy *= -1;

    // left paddle
    if (state.ball.x <= 42 &&
        state.ball.y >= state.left.y &&
        state.ball.y <= state.left.y + 100)
        state.ball.vx *= -1;

    // right paddle
    if (state.ball.x >= 760 &&
        state.ball.y >= state.right.y &&
        state.ball.y <= state.right.y + 100)
        state.ball.vx *= -1;

    // scoring
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
    const payload = JSON.stringify({
        type: "state",
        state
    });

    wss.clients.forEach(c => {
        if (c.readyState === 1)
            c.send(payload);
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

console.log("Multiplayer server running on ws://localhost:8080");
