import { Game } from './game.js';
import { CONFIG } from './config.js';
import { Input } from './systems/input.js';

const canvas = document.getElementById('gameCanvas');

// ----------------------------------------
// Canvas setup
// ----------------------------------------
function setupCanvas(canvas, config) {
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const scale = dpr;

    canvas.style.width = `${config.width}px`;
    canvas.style.height = `${config.height}px`;

    canvas.width = config.width * scale;
    canvas.height = config.height * scale;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    return { ctx, scale };
}

const { ctx, scale } = setupCanvas(canvas, CONFIG);

const input = new Input(window);
const game = new Game(canvas, ctx, scale, input);

// ----------------------------------------
// WebSocket connection handling
// ----------------------------------------
let socket;
let side = "spectator";
let connected = false;

/* WebSocket connection - supports both local dev and production (render.com) */
function createSocket() {
    // Use wss:// for HTTPS, ws:// for HTTP
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';

    // Construct URL based on environment
    let url;
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        // Local development: use port 8080
        url = `${protocol}//${location.hostname}:8080`;
    } else {
        // Production (render.com): use same port as webpage (no explicit port for 443/80)
        url = `${protocol}//${location.hostname}`;
    }

    console.log("[WS] Connecting to:", url);
    socket = new WebSocket(url);

    socket.onopen = () => {
        connected = true;
        console.log("[WS] Connected");
    };

    socket.onmessage = evt => {
        const msg = JSON.parse(evt.data);

        if (msg.type === "side") {
            side = msg.side;
            console.log("[WS] Assigned side:", side);
        }

        if (msg.type === "state") {
            game.applyMultiplayerState(msg.state);
        }
    };

    socket.onclose = () => {
        connected = false;
        console.warn("[WS] Connection lost. Reconnecting in 1s...");
        setTimeout(createSocket, 1000);
    };

    socket.onerror = err => {
        console.error("[WS] Error:", err);
    };
}

// Start WS connection
createSocket();

// ----------------------------------------
// Send paddle movement to server
// ----------------------------------------
function sendPaddle() {
    if (!connected) return;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    if (side !== "left" && side !== "right") return;

    const paddle = side === "left" ? game.left : game.right;

    socket.send(JSON.stringify({
        type: "move",
        y: paddle.y
    }));
}

// ----------------------------------------
// Game loop
// ----------------------------------------
function gameLoop() {
    game.updateLocal(side);
    game.updatePhysics();
    game.render();

    sendPaddle();

    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
