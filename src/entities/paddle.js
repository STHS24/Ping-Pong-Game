export class Paddle {
  constructor(x=0, y=0) {
    this.x = x;
    this.y = y;
    this.width = 12;
    this.height = 100;
    this.speed = 6;
  }

  updateFromInput(input, dt) {
    if (input.isKeyDown('ArrowUp')) this.y -= this.speed * dt;
    if (input.isKeyDown('ArrowDown')) this.y += this.speed * dt;
    this.clamp(0, 600); // canvas height default, better get from config
  }

  updateFromAI(ai, ball, dt) {
    const dir = ai.getPaddleDirection(this, ball);
    this.y += dir * this.speed * dt;
    this.clamp(0, 600);
  }

  clamp(minY, maxY) {
    if (this.y < minY) this.y = minY;
    if (this.y + this.height > maxY) this.y = maxY - this.height;
  }
}