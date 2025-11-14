import { Ball } from './entities/ball.js';
import { Paddle } from './entities/paddle.js';
import { Renderer } from './render/renderer.js';
import { CONFIG } from './config.js';

export class Game {
    constructor(canvas, ctx, scale, input) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.scale = scale;

        this.renderer = new Renderer(this.ctx, this.scale);
        this.input = input;

        this.left = new Paddle(30, 250);
        this.right = new Paddle(760, 250);
        this.ball = new Ball(400, 300);

        this.score = { left: 0, right: 0 };
    }

    start() {}

    // server overwrites full state here
    applyMultiplayerState(state) {
        this.left.y = state.left.y;
        this.right.y = state.right.y;

        this.ball.x = state.ball.x;
        this.ball.y = state.ball.y;

        this.score.left = state.score.left;
        this.score.right = state.score.right;
    }

    updateLocal(side) {
        const p = side === "left" ? this.left : side === "right" ? this.right : null;
        if (!p) return;

        if (this.input.keys["ArrowUp"] || this.input.keys["KeyW"])
            p.y -= 6;
        if (this.input.keys["ArrowDown"] || this.input.keys["KeyS"])
            p.y += 6;

        p.y = Math.max(0, Math.min(600 - 100, p.y));
    }

    render() {
        this.renderer.render(this.canvas, this.ball, this.left, this.right, this.score);
    }
}
