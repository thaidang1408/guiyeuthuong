// Cánh hoa rơi nhẹ bằng canvas. Trả về hàm stop() để dừng và dọn dẹp.
import { canvasDpr, motionCount, prefersReducedMotion } from './dom.js';

const COLORS = ['#ffc2d1', '#ffb3c6', '#ffe5ec', '#fbb1bd', '#ffd6a5'];

export function startPetals({ count = 26 } = {}) {
  if (prefersReducedMotion()) return () => {};
  count = motionCount(count);

  const canvas = document.createElement('canvas');
  canvas.className = 'fx-canvas fx-petals';
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  const dpr = canvasDpr();
  let w = 0;
  let h = 0;
  const resize = () => {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);

  const petal = (initial) => ({
    x: Math.random() * w,
    y: initial ? Math.random() * h : -20,
    size: 7 + Math.random() * 7,
    speed: 0.6 + Math.random() * 0.9,
    drift: Math.random() * Math.PI * 2,
    spin: Math.random() * Math.PI,
    spinSpeed: (Math.random() - 0.5) * 0.04,
    color: COLORS[(Math.random() * COLORS.length) | 0],
  });
  const petals = Array.from({ length: count }, () => petal(true));

  let running = true;
  let raf = 0;
  function frame() {
    if (!running) return;
    ctx.clearRect(0, 0, w, h);
    for (const p of petals) {
      p.y += p.speed;
      p.drift += 0.012;
      p.x += Math.sin(p.drift) * 0.6;
      p.spin += p.spinSpeed;
      if (p.y > h + 20) Object.assign(p, petal(false));
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    raf = requestAnimationFrame(frame);
  }
  // Tạm dừng khi tab ẩn để đỡ tốn pin.
  const onVisibility = () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else if (running) raf = requestAnimationFrame(frame);
  };
  document.addEventListener('visibilitychange', onVisibility);
  raf = requestAnimationFrame(frame);

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onVisibility);
    canvas.remove();
  };
}
