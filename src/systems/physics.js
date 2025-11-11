export class Physics {
  constructor(config) {
    this.config = config;
  }

  step(ball, paddles, config) {
    // move ball
    ball.x += ball.vx;
    ball.y += ball.vy;

    // top/bottom collision
    if (ball.y - ball.radius < 0) {
      ball.y = ball.radius;
      ball.vy *= -1;
    } else if (ball.y + ball.radius > config.height) {
      ball.y = config.height - ball.radius;
      ball.vy *= -1;
    }

    // paddle collisions
    for (const p of paddles) {
      if (ball.x - ball.radius < p.x + p.width &&
          ball.x + ball.radius > p.x &&
          ball.y - ball.radius < p.y + p.height &&
          ball.y + ball.radius > p.y) {
        // basic reflect
        ball.vx *= -1.05; // speed up a bit
        // tweak vy based on where it hit the paddle
        const rel = (ball.y - (p.y + p.height / 2)) / (p.height / 2);
        ball.vy += rel * 2;
        // push ball out to avoid sticking
        if (ball.vx > 0) ball.x = p.x + p.width + ball.radius;
        else ball.x = p.x - ball.radius;
      }
    }

    // scoring (simple)
    if (ball.x < 0) {
      ball.reset(config.width / 2, config.height / 2, config.initialBallSpeed);
    } else if (ball.x > config.width) {
      ball.reset(config.width / 2, config.height / 2, config.initialBallSpeed);
    }
  }
}