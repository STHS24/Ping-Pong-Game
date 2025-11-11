// Entrada: main.js atualizado para configurar canvas com scale inteiro e passar ctx ajustado ao Game
import { Game } from './game.js';
import { CONFIG } from './config.js';

const canvas = document.getElementById('gameCanvas');

function setupCanvas(canvas, config) {
  // escolher scale inteiro baseado em devicePixelRatio para manter nitidez
  const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  const scale = dpr;

  // CSS tamanho permanece o tamanho lógico do jogo
  canvas.style.width = `${config.width}px`;
  canvas.style.height = `${config.height}px`;

  // tamanho interno do canvas = lógico * scale
  canvas.width = config.width * scale;
  canvas.height = config.height * scale;

  const ctx = canvas.getContext('2d');
  // desativa suavização de imagens (importantíssimo para pixel art)
  ctx.imageSmoothingEnabled = false;
  // ajusta transform para desenhar em coordenadas lógicas (1..width, 1..height)
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  // quando a janela muda de DPR/resize você pode recomputar (opcional)
  return { ctx, scale };
}

const { ctx, scale } = setupCanvas(canvas, CONFIG);

const game = new Game(canvas, ctx, scale);
game.start();

// export para facilitar debug se quiser
export { game };