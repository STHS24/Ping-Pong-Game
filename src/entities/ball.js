export class Ball {
  constructor(x=0, y=0) {
    this.x = x;
    this.y = y;
    this.vx = 5;
    this.vy = 2;
    this.radius = 8;
  }

  reset(x, y, speed=5) {
    this.x = x; this.y = y;
    this.vx = (Math.random() > 0.5 ? 1 : -1) * speed;
    this.vy = (Math.random() - 0.5) * speed;
  }
}