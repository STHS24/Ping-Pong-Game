export class AI {
  constructor() {
    this.difficulty = 0.9; // 0..1 (1 is perfect)
  }

  getPaddleDirection(paddle, ball) {
    const paddleCenter = paddle.y + paddle.height / 2;
    const dx = ball.x - (paddle.x);
    // basic lead: prefer to move towards ball y, scaled by difficulty and distance
    const targetY = ball.y;
    const diff = targetY - paddleCenter;
    const sign = Math.sign(diff);
    const magnitude = Math.min(Math.abs(diff) / 30, 1) * this.difficulty;
    return magnitude * sign;
  }
}