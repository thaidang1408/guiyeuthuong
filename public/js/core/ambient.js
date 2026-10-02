// Hiệu ứng nền cho trang thiệp:
//  - quầng sáng mờ trôi chậm phía sau (chỉ CSS, theo màu của từng mẫu)
//  - vệt lấp lánh theo ngón tay: chạm/vuốt đâu cũng toé sao nhỏ (canvas, tự ngủ khi không có hạt nào)
import { canvasDpr, el, prefersReducedMotion } from './dom.js';

export function ambientLayer() {
  return el('div', { class: 'fx-ambient', attrs: { 'aria-hidden': 'true' } }, [el('i'), el('i'), el('i'), el('i')]);
}

const MAX = 140;

export function enableSparkles(root) {
  if (prefersReducedMotion()) return;
  const canvas = el('canvas', { class: 'fx-sparkles', attrs: { 'aria-hidden': 'true' } });
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  const dpr = canvasDpr();
  const resize = () => {
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  addEventListener('resize', resize);

  const accent = getComputedStyle(root).getPropertyValue('--tt-accent').trim() || '#ff4d6d';
  const colors = [accent, '#ffd166', '#ffffff', '#ffc2d1'];
  const parts = [];
  let running = false;

  const spawn = (x, y, n, spread) => {
    for (let i = 0; i < n && parts.length < MAX; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * spread;
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.6, life: 1, size: 3 + Math.random() * 5, rot: Math.random() * Math.PI, color: colors[(Math.random() * colors.length) | 0] });
    }
    if (!running) {
      running = true;
      requestAnimationFrame(frame);
    }
  };

  /** Ngôi sao 4 cánh lấp lánh. */
  const star = (p) => {
    const r = p.size * p.life;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const rad = i % 2 ? r * 0.28 : r;
      const a = (Math.PI / 4) * i;
      ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life;
    ctx.fill();
    ctx.restore();
  };

  function frame() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.vy += 0.04;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += 0.08;
      p.life -= 0.022;
      if (p.life <= 0) parts.splice(i, 1);
      else star(p);
    }
    ctx.globalCompositeOperation = 'source-over';
    if (parts.length) requestAnimationFrame(frame);
    else {
      running = false;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
    }
  }

  let lastMove = 0;
  root.addEventListener('pointerdown', (e) => spawn(e.clientX, e.clientY, 12, 3.2), { passive: true });
  root.addEventListener(
    'pointermove',
    (e) => {
      if (!e.buttons && e.pointerType !== 'mouse') return;
      const now = performance.now();
      if (now - lastMove < 24) return;
      lastMove = now;
      spawn(e.clientX, e.clientY, e.pointerType === 'mouse' ? 1 : 2, 1.2);
    },
    { passive: true },
  );
}
