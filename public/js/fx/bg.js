// Hiệu ứng nền chạy suốt thiệp, nằm sau lớp chữ: đom đóm, bong bóng, bướm, tuyết, trời sao, tim bay.
// Một canvas duy nhất, tự dừng khi tab ẩn. Máy bật "giảm chuyển động" thì ít hạt hơn.
import { canvasDpr, el, motionCount } from '../core/dom.js';

const KINDS = {
  'dom-dom': { n: 34, make: (w, h) => ({ x: rnd(w), y: rnd(h), a: rnd(6.28), v: 0.15 + rnd(0.35), r: 1.5 + rnd(2), p: rnd(6.28) }), step: firefly },
  'bong-bong': { n: 22, make: (w, h, init) => ({ x: rnd(w), y: init ? rnd(h) : h + 40, r: 8 + rnd(22), v: 0.3 + rnd(0.6), p: rnd(6.28) }), step: bubble },
  buom: { n: 9, make: (w, h) => ({ x: rnd(w), y: rnd(h), a: rnd(6.28), v: 0.5 + rnd(0.6), s: 18 + rnd(12), p: rnd(6.28) }), step: butterfly },
  tuyet: { n: 70, make: (w, h, init) => ({ x: rnd(w), y: init ? rnd(h) : -10, r: 1 + rnd(2.6), v: 0.4 + rnd(0.9), p: rnd(6.28) }), step: snow },
  sao: { n: 45, make: (w, h) => ({ x: rnd(w), y: rnd(h), r: 0.6 + rnd(1.6), p: rnd(6.28), f: 0.001 + rnd(0.003) }), step: star },
  'tim-bay': { n: 18, make: (w, h, init) => ({ x: rnd(w), y: init ? rnd(h) : h + 30, s: 8 + rnd(14), v: 0.3 + rnd(0.5), p: rnd(6.28), c: rnd(1) < 0.5 ? '#ff5c8a' : '#ff9cbf' }), step: heart },
};

function rnd(n) {
  return Math.random() * n;
}

/** Vẽ sẵn một lần ra canvas nhỏ, mỗi khung chỉ cần drawImage (rẻ hơn nhiều so với tạo gradient). */
function sprite(size, paint) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  paint(c.getContext('2d'), size);
  return c;
}
let fireflySprite;
let bubbleSprite;

export function startBackground(kind) {
  const spec = KINDS[kind];
  if (!spec) return null;
  const canvas = el('canvas', { class: `fx-bg fx-bg-${kind}`, attrs: { 'aria-hidden': 'true' } });
  const ctx = canvas.getContext('2d');
  const dpr = canvasDpr();
  let w = 0;
  let h = 0;
  const resize = () => {
    w = innerWidth;
    h = innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  addEventListener('resize', resize);
  const items = Array.from({ length: motionCount(spec.n) }, () => spec.make(w, h, true));
  const shooting = [];
  let raf = 0;
  let last = 0;
  const frame = (t) => {
    const dt = Math.min(50, last ? t - last : 16) / 16;
    last = t;
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < items.length; i++) {
      if (spec.step(ctx, items[i], t, dt, w, h)) items[i] = spec.make(w, h, false);
    }
    if (kind === 'sao') shoot(ctx, shooting, dt, w, h);
    raf = requestAnimationFrame(frame);
  };
  const play = () => !raf && !document.hidden && (raf = requestAnimationFrame(frame));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    } else play();
  });
  play();
  return canvas;
}

// Mỗi hàm vẽ một hạt, trả về true khi hạt đã ra khỏi màn hình (tạo hạt mới thay thế).

function firefly(ctx, f, t, dt, w, h) {
  f.a += (Math.random() - 0.5) * 0.15 * dt;
  f.x = (f.x + Math.cos(f.a) * f.v * dt + w) % w;
  f.y = (f.y + Math.sin(f.a) * f.v * dt + h) % h;
  const glow = 0.25 + 0.75 * Math.max(0, Math.sin(f.p + t * 0.002));
  // Màu cam vàng đậm để vẫn thấy rõ trên nền thiệp sáng.
  fireflySprite ??= sprite(48, (g, s) => {
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, 'rgba(255, 196, 0, 1)');
    grad.addColorStop(0.3, 'rgba(255, 150, 20, 0.5)');
    grad.addColorStop(1, 'rgba(255, 140, 0, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
  });
  ctx.globalAlpha = glow;
  ctx.drawImage(fireflySprite, f.x - f.r * 6, f.y - f.r * 6, f.r * 12, f.r * 12);
  ctx.globalAlpha = 1;
  return false;
}

function bubble(ctx, b, t, dt) {
  b.y -= b.v * dt;
  b.x += Math.sin(b.p + t * 0.0012) * 0.4 * dt;
  bubbleSprite ??= sprite(96, (g, s) => {
    const r = s / 2;
    const grad = g.createRadialGradient(r - r * 0.35, r - r * 0.35, r * 0.1, r, r, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.55)');
    grad.addColorStop(0.6, 'rgba(255,220,240,0.08)');
    grad.addColorStop(0.9, 'rgba(160,220,255,0.25)');
    grad.addColorStop(1, 'rgba(255,170,220,0.45)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(r, r, r, 0, Math.PI * 2);
    g.fill();
  });
  ctx.drawImage(bubbleSprite, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
  return b.y < -b.r * 2;
}

function butterfly(ctx, b, t, dt, w, h) {
  b.a += Math.sin(t * 0.001 + b.p) * 0.03 * dt;
  b.x += Math.cos(b.a) * b.v * dt;
  b.y += Math.sin(b.a) * b.v * 0.6 * dt + Math.sin(t * 0.004 + b.p) * 0.3;
  if (b.x < -40) b.x = w + 30;
  if (b.x > w + 40) b.x = -30;
  if (b.y < -40) b.y = h + 30;
  if (b.y > h + 40) b.y = -30;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.scale(Math.cos(b.a) < 0 ? -1 : 1, 1);
  // Vỗ cánh: co giãn chiều ngang theo nhịp.
  ctx.scale(0.35 + 0.65 * Math.abs(Math.sin(t * 0.012 + b.p)), 1);
  ctx.globalAlpha = 0.85;
  ctx.font = `${b.s}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🦋', 0, 0);
  ctx.restore();
  return false;
}

function snow(ctx, s, t, dt, w, h) {
  s.y += s.v * dt;
  s.x += Math.sin(s.p + t * 0.001) * 0.5 * dt;
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = 'rgba(170, 140, 165, 0.55)'; // viền mờ để tuyết trắng vẫn nổi trên nền sáng
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(s.x, s.y, s.r + 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  return s.y > h + 10;
}

function star(ctx, s, t) {
  ctx.globalAlpha = 0.25 + 0.75 * Math.abs(Math.sin(s.p + t * s.f));
  ctx.fillStyle = '#f2a900';
  const r = s.r * 2.2;
  ctx.beginPath(); // sao 4 cánh
  ctx.moveTo(s.x, s.y - r);
  ctx.quadraticCurveTo(s.x, s.y, s.x + r, s.y);
  ctx.quadraticCurveTo(s.x, s.y, s.x, s.y + r);
  ctx.quadraticCurveTo(s.x, s.y, s.x - r, s.y);
  ctx.quadraticCurveTo(s.x, s.y, s.x, s.y - r);
  ctx.fill();
  ctx.globalAlpha = 1;
  return false;
}

function shoot(ctx, list, dt, w, h) {
  if (Math.random() < 0.004 * dt) list.push({ x: rnd(w * 0.8), y: rnd(h * 0.4), life: 1 });
  ctx.strokeStyle = '#f2a900';
  ctx.lineWidth = 1.5;
  for (let i = list.length - 1; i >= 0; i--) {
    const s = list[i];
    s.x += 9 * dt;
    s.y += 3.5 * dt;
    s.life -= 0.02 * dt;
    if (s.life <= 0) {
      list.splice(i, 1);
      continue;
    }
    ctx.globalAlpha = s.life;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x - 80 * s.life, s.y - 30 * s.life);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function heart(ctx, p, t, dt) {
  p.y -= p.v * dt;
  p.x += Math.sin(p.p + t * 0.0015) * 0.5 * dt;
  const s = p.s;
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = p.c;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y + s * 0.3);
  ctx.bezierCurveTo(p.x, p.y, p.x - s * 0.5, p.y, p.x - s * 0.5, p.y + s * 0.3);
  ctx.bezierCurveTo(p.x - s * 0.5, p.y + s * 0.6, p.x, p.y + s * 0.8, p.x, p.y + s);
  ctx.bezierCurveTo(p.x, p.y + s * 0.8, p.x + s * 0.5, p.y + s * 0.6, p.x + s * 0.5, p.y + s * 0.3);
  ctx.bezierCurveTo(p.x + s * 0.5, p.y, p.x, p.y, p.x, p.y + s * 0.3);
  ctx.fill();
  ctx.globalAlpha = 1;
  return p.y < -s * 2;
}
