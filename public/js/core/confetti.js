// Pháo giấy bắn từ hai góc dưới màn hình: dải giấy lật 3D (co giãn theo cos), rơi có lực cản.
import { canvasDpr, motionCount, prefersReducedMotion } from './dom.js';
import { sfx } from './sfx.js';

const COLORS = ['#ff4d6d', '#ffd166', '#06d6a0', '#4cc9f0', '#ff8fab', '#c77dff', '#ffffff'];

export function confettiCannon({ count = 150, duration = 3800 } = {}) {
  if (prefersReducedMotion()) return Promise.resolve();
  count = motionCount(count);
  sfx.party();
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

  const pieces = Array.from({ length: count }, (_, i) => {
    const left = i % 2 === 0;
    // Góc bắn: chếch vào giữa màn hình từ mỗi góc dưới.
    const angle = -Math.PI / 2 + (left ? 0.45 : -0.45) + (Math.random() - 0.5) * 0.6;
    const speed = (11 + Math.random() * 9) * Math.min(1.3, h / 700);
    return {
      x: left ? -10 : w + 10,
      y: h + 10,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      w: 6 + Math.random() * 6,
      h: 10 + Math.random() * 10,
      spin: Math.random() * Math.PI * 2,
      spinSpeed: 0.1 + Math.random() * 0.25,
      tilt: Math.random() * Math.PI,
      color: COLORS[i % COLORS.length],
      delay: Math.random() * 300,
    };
  });

  const start = performance.now();
  return new Promise((resolve) => {
    function frame(t) {
      const elapsed = t - start;
      ctx.clearRect(0, 0, w, h);
      for (const p of pieces) {
        if (elapsed < p.delay) continue;
        p.vx *= 0.985;
        p.vy = p.vy * 0.985 + 0.32;
        if (p.vy > 3.2) p.vy = 3.2; // rơi lơ lửng như giấy
        p.x += p.vx + Math.sin(p.spin) * 0.8;
        p.y += p.vy;
        p.spin += p.spinSpeed;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.tilt + p.spin * 0.3);
        ctx.scale(1, Math.cos(p.spin)); // lật mặt giấy
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, Math.min(1, (duration - elapsed) / 600));
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (elapsed < duration) requestAnimationFrame(frame);
      else {
        canvas.remove();
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}
