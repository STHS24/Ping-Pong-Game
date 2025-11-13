// Renderer ajustado para pixel-perfect: desliga suavização e arredonda posições
export class Renderer {
  constructor(ctx, scale = 1) {
    this.ctx = ctx;
    this.scale = scale || 1;
  }

  render(canvas, ball, left, right, score) {
    const ctx = this.ctx;
    // Limpa usando coordenadas lógicas (canvas.width/scale == logical width)
    ctx.clearRect(0, 0, canvas.width / this.scale, canvas.height / this.scale);

    const r = n => Math.round(n); // arredonda para manter pixels inteiros
        if (!window._loggedR) {
          console.log("[DEBUG][renderer.js] Entering arrow function: r");
          window._loggedR = true;
    }


    // midline
    ctx.fillStyle = '#333';
    for (let y = 0; y < canvas.height / this.scale; y += 24) {
      ctx.fillRect(r(canvas.width / this.scale / 2 - 2), r(y), 4, 12);
    }

    // ball
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    // para círculo, arredondar centro ajuda a manter nitidez
    ctx.arc(r(ball.x), r(ball.y), ball.radius, 0, Math.PI * 2);
    ctx.fill();

    // paddles
    ctx.fillStyle = '#fff';
    ctx.fillRect(r(left.x), r(left.y), r(left.width), r(left.height));
    ctx.fillRect(r(right.x), r(right.y), r(right.width), r(right.height));

    // score
    ctx.fillStyle = '#fff';
    ctx.font = '36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(score.left), (canvas.width / this.scale) / 2 - 60, 50);
    ctx.fillText(String(score.right), (canvas.width / this.scale) / 2 + 60, 50);
  }
}