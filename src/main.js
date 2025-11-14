import { Game } from './game.js';
import { CONFIG } from './config.js';
import { Input } from './systems/input.js';

const canvas = document.getElementById('gameCanvas');

// Set up canvas scale
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

// 🎮 Multiplayer WebSocket
const socket = new WebSocket("ws://localhost:8080");
let side = "spectator";

socket.onmessage = evt => {
    const msg = JSON.parse(evt.data);

    if (msg.type === "side") {
        side = msg.side;
        console.log("Assigned side:", side);
    }

    if (msg.type === "state") {
        game.applyMultiplayerState(msg.state);
    }
};

// 🎮 Send paddle movement
function sendPaddle() {
    if (side === "left" || side === "right") {
        const paddle = side === "left" ? game.left : game.right;

        socket.send(JSON.stringify({
            type: "move",
            y: paddle.y
        }));
    }
}

function gameLoop() {
    game.updateLocal(side);
    game.render();

    sendPaddle();
    requestAnimationFrame(gameLoop);
}

game.start();
requestAnimationFrame(gameLoop);
