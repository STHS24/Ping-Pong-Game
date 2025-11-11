// Updated physics.step: returns { scorer: 'left'|'right' } when a point occurs, otherwise null.
// Does not change the score directly — leaves that to Game.
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
        // ensure ball is moving away from paddle after collision
        const incomingRight = ball.vx > 0;
        ball.vx *= -1.05; // invert and slightly speed up
        // tweak vy based on where it hit the paddle
        const rel = (ball.y - (p.y + p.height / 2)) / (p.height / 2);
        ball.vy += rel * 2;
        // push ball out to avoid sticking
        if (incomingRight) {
          // ball was moving right, now moving left -> place right of paddle
          ball.x = p.x - ball.radius;
        } else {
          ball.x = p.x + p.width + ball.radius;
        }
      }
    }

    // scoring detection (do NOT reset score here)
    if (ball.x + ball.radius < 0) {
      // ball fully left -> right player scores
      return { scorer: 'right' };
    } else if (ball.x - ball.radius > config.width) {
      // ball fully right -> left player scores
      return { scorer: 'left' };
    }

    return null;
  }
}