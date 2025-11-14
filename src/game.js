// Multiplayer-compatible Game class
// Works both offline (AI) and online (WebSocket sync)

import { Ball } from './entities/ball.js';
import { Paddle } from './entities/paddle.js';
import { Input } from './systems/input.js';
import { Physics } from './systems/physics.js';
import { AI } from './systems/ai.js';
import { Renderer } from './render/renderer.js';
import { CONFIG } from './config.js';

export class Game {
    constructor(canvas, ctx, scale = 1, input = null) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.scale = scale;
        this.renderer = new Renderer(this.ctx, this.scale);
        this.input = input || new Input(window);
        this.physics = new Physics(CONFIG);
        this.ai = new AI();

        // Multiplayer flags
        this.multiplayer = false;
        this.side = "spectator";

        this.resetMatch();
        this.lastTs = 0;
        this._running = false;
    }

    // Reset scores and system
    resetMatch() {
        this.score = { left: 0, right: 0 };
        this.resetRound();
    }

    // Reset ball/paddles but preserve score
    resetRound() {
        const midY = CONFIG.height / 2;

        this.left = new Paddle(30, midY - CONFIG.paddleHeight / 2);
        this.right = new Paddle(
            CONFIG.width - 30 - CONFIG.paddleWidth,
            midY - CONFIG.paddleHeight / 2
        );

        this.ball = new Ball(CONFIG.width / 2, CONFIG.height / 2);
        this.ball.reset(
            CONFIG.width / 2,
            CONFIG.height / 2,
            CONFIG.initialBallSpeed
        );
    }

    // Called by WebSocket client
    applyMultiplayerState(state, mySide) {
        this.multiplayer = true;

        // Only update opponent's paddle, not your own (client-side prediction)
        // This prevents flickering from local input fighting with server updates
        if (mySide !== "left") {
            this.left.y = state.left.y;
        }
        if (mySide !== "right") {
            this.right.y = state.right.y;
        }

        // Server is authoritative for ball and score
        this.ball.x = state.ball.x;
        this.ball.y = state.ball.y;

        this.score.left = state.score.left;
        this.score.right = state.score.right;
    }

    // Local input system depending on multiplayer mode
    updateLocal(side) {
        this.side = side;

        // NOT multiplayer → normal player vs AI
        if (!this.multiplayer) {
            this.left.updateFromInput(this.input, 1);
            this.right.updateFromAI(this.ai, this.ball, 1);
            return;
        }

        // MULTIPLAYER:
        // You only update your own paddle
        if (side === "left") {
            this.left.updateFromInput(this.input, 1);
        } else if (side === "right") {
            this.right.updateFromInput(this.input, 1);
        }

        // Opponent is controlled by server, do nothing
    }

    // Public render method for external game loop
    render() {
        this.renderer.render(
            this.canvas,
            this.ball,
            this.left,
            this.right,
            this.score
        );
    }

    // Update physics (for offline mode only)
    updatePhysics() {
        if (!this.multiplayer) {
            const scoreEvent = this.physics.step(
                this.ball,
                [this.left, this.right],
                CONFIG
            );

            if (scoreEvent) {
                if (scoreEvent.scorer === "left") this.score.left++;
                if (scoreEvent.scorer === "right") this.score.right++;
                this.resetRound();
            }
        }
    }
}
