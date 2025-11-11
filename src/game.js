// Ajuste mínimo para aceitar ctx/scale e passar para Renderer
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
    this.reset();
    this.lastTs = 0;
    this._running = false;
  }

  // ... o resto fica igual (loop, reset, start)
  reset() {
    const midY = CONFIG.height / 2;
    this.left = new Paddle(30, midY - CONFIG.paddleHeight/2);
    this.right = new Paddle(CONFIG.width - 30 - CONFIG.paddleWidth, midY - CONFIG.paddleHeight/2);
    this.ball = new Ball(CONFIG.width / 2, CONFIG.height / 2);
    this.score = { left: 0, right: 0 };
  }

  start() {
    this._running = true;
    requestAnimationFrame(this.loop.bind(this));
  }

  stop() { this._running = false; }

  loop(ts) {
    if (!this._running) return;
    const dt = Math.min((ts - this.lastTs) / 16.6667, 4);
    this.lastTs = ts;

    this.left.updateFromInput(this.input, dt);
    this.right.updateFromAI(this.ai, this.ball, dt);

    this.physics.step(this.ball, [this.left, this.right], CONFIG);

    this.renderer.render(this.canvas, this.ball, this.left, this.right, this.score);

    requestAnimationFrame(this.loop.bind(this));
  }
}