// Trái tim bung ra rồi bay lên — dùng khi người nhận bấm "Tha".
import { canvasDpr, motionCount, prefersReducedMotion } from './dom.js';

const COLORS = ['#ff4d6d', '#ff758f', '#ff8fa3', '#ffb3c1', '#c9184a'];

function drawHeart(ctx, size) {
  ctx.beginPath();
  ctx.moveTo(0, size * 0.3);
  ctx.bezierCurveTo(-size, -size * 0.4, -size * 0.4, -size * 1.1, 0, -size * 0.45);
  ctx.bezierCurveTo(size * 0.4, -size * 1.1, size, -size * 0.4, 0, size * 0.3);
  ctx.fill();
}

export function burstHearts({ duration = 3000, count = 46 } = {}) {
  if (prefersReducedMotion()) return Promise.resolve();
  count = motionCount(count);

  const canvas = document.createElement('canvas');
  canvas.className = 'fx-canvas';
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  const dpr = canvasDpr();
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const hearts = Array.from({ length: count }, (_, i) => {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
    const speed = 2.5 + Math.random() * 4;
    return {
      x: w / 2,
      y: h / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      size: 8 + Math.random() * 12,
      life: 1,
      wobble: Math.random() * Math.PI * 2,
      color: COLORS[i % COLORS.length],
    };
  });

  const start = performance.now();
  return new Promise((resolve) => {
    function frame(t) {
      ctx.clearRect(0, 0, w, h);
      for (const p of hearts) {
        p.vx *= 0.97;
        p.vy = p.vy * 0.97 - 0.04; // bay dần lên
        p.wobble += 0.08;
        p.x += p.vx + Math.sin(p.wobble) * 0.5;
        p.y += p.vy;
        p.life -= 0.006;
        if (p.life <= 0) continue;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        drawHeart(ctx, p.size);
        ctx.restore();
      }
      if (t - start < duration) requestAnimationFrame(frame);
      else {
        canvas.remove();
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}
