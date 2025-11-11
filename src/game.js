// Updated Game to handle scoring events and use resetRound() vs resetMatch().
// resetMatch clears scores (use at match start), resetRound repositions ball/paddles but preserves score.

import { Ball } from './entities/ball.js';
import { Paddle } from './entities/paddle.js';
import { Input } from './systems/input.js';
import { Physics } from './systems/physics.js';
import { AI } from './systems/ai.js';
import { Renderer } from './render/renderer.js';
import { CONFIG } from './config.js';

export class Game {
  constructor(canvas, ctx, scale = 1) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.scale = scale;
    this.renderer = new Renderer(this.ctx, this.scale);
    this.input = new Input(window);
    this.physics = new Physics(CONFIG);
    this.ai = new AI();
    this.resetMatch(); // full reset at creation (clears score)
    this.lastTs = 0;
    this._running = false;
  }

  // full match reset (scores set to 0)
  resetMatch() {
    this.score = { left: 0, right: 0 };
    this.resetRound(); // position ball/paddles for new round
  }

  // round reset: reposition ball & paddles, preserve score
  resetRound() {
    const midY = CONFIG.height / 2;
    this.left = new Paddle(30, midY - CONFIG.paddleHeight / 2);
    this.right = new Paddle(CONFIG.width - 30 - CONFIG.paddleWidth, midY - CONFIG.paddleHeight / 2);
    this.ball = new Ball(CONFIG.width / 2, CONFIG.height / 2);
    // optional: give the ball a start velocity towards the last scorer/alternate
    this.ball.reset(CONFIG.width / 2, CONFIG.height / 2, CONFIG.initialBallSpeed);
  }

  start() {
    this._running = true;
    requestAnimationFrame(this.loop.bind(this));
  }

  stop() {
    this._running = false;
  }

  loop(ts) {
    if (!this._running) return;
    const dt = Math.min((ts - this.lastTs) / 16.6667, 4); // normalized delta
    this.lastTs = ts;

    // update input-controlled paddle
    this.left.updateFromInput(this.input, dt);
    // AI controls right paddle
    this.right.updateFromAI(this.ai, this.ball, dt);

    // physics step: returns scoring event if a point occurred
    const scoreEvent = this.physics.step(this.ball, [this.left, this.right], CONFIG);

    // handle scoring
    if (scoreEvent) {
      if (scoreEvent.scorer === 'left') {
        this.score.left += 1;
      } else if (scoreEvent.scorer === 'right') {
        this.score.right += 1;
      }
      // reset for next round (preserve score)
      this.resetRound();
    }

    // rendering
    this.renderer.render(this.canvas, this.ball, this.left, this.right, this.score);

    requestAnimationFrame(this.loop.bind(this));
  }
}