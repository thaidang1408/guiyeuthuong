// Pháo hoa canvas: pháo bắn từ dưới lên có vệt sáng, nổ thành trái tim / vòng tròn / mưa kim tuyến,
// vệt mờ dần như pháo thật (pha màu cộng sáng "lighter"). Tự dọn dẹp khi xong, tôn trọng giảm chuyển động.
import { canvasDpr, motionCount, prefersReducedMotion } from './dom.js';
import { sfx } from './sfx.js';

const PALETTES = [
  ['#ff4d6d', '#ff8fab', '#ffc2d1'],
  ['#ffd166', '#ffb347', '#fff3b0'],
  ['#ff6b9d', '#c77dff', '#ffd6ff'],
  ['#4cc9f0', '#90e0ef', '#ffffff'],
  ['#ff9e00', '#ff5400', '#ffd166'],
];
const MAX_PARTICLES = 1100;

/** Chớp sáng trắng tròn, vẽ sẵn một lần (trước tạo gradient cho từng hạt mỗi khung). */
let flashSprite;
function flash() {
  if (flashSprite) return flashSprite;
  flashSprite = document.createElement('canvas');
  flashSprite.width = flashSprite.height = 64;
  const g = flashSprite.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return flashSprite;
}

/** Điểm trên đường viền trái tim (t: 0 → 2π), đã chuẩn hóa khoảng -1..1. */
function heartPoint(t) {
  const x = 16 * Math.sin(t) ** 3;
  const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
  return [x / 17, y / 17];
}

export function launchFireworks({ duration = 3600, bursts = 7 } = {}) {
  if (prefersReducedMotion()) return Promise.resolve();
  bursts = motionCount(bursts);

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

  const rockets = [];
  const particles = [];
  const scale = Math.min(w, h) / 360;

  let lastBoom = 0;
  const explode = (x, y, kind) => {
    if (performance.now() - lastBoom > 250) {
      lastBoom = performance.now();
      sfx.boom();
    }
    const pal = PALETTES[(Math.random() * PALETTES.length) | 0];
    const n = kind === 'heart' ? 70 : 60;
    for (let i = 0; i < n && particles.length < MAX_PARTICLES; i++) {
      let vx;
      let vy;
      if (kind === 'heart') {
        const [hx, hy] = heartPoint((Math.PI * 2 * i) / n);
        vx = hx * 4.2 * scale;
        vy = hy * 4.2 * scale;
      } else {
        const a = (Math.PI * 2 * i) / n;
        const sp = (kind === 'ring' ? 3.6 : 1.5 + Math.random() * 3) * scale;
        vx = Math.cos(a) * sp;
        vy = Math.sin(a) * sp;
      }
      particles.push({
        x, y, vx, vy,
        life: 1,
        decay: 0.009 + Math.random() * 0.008,
        color: pal[i % pal.length],
        size: 1.6 + Math.random() * 1.6,
        glitter: kind === 'glitter' || Math.random() < 0.15,
      });
    }
    // Lóe sáng ở tâm vụ nổ
    particles.push({ x, y, vx: 0, vy: 0, life: 1, decay: 0.06, color: '#fff', size: 26 * scale, flash: true });
  };

  const KINDS = ['heart', 'ring', 'glitter', 'heart', 'burst'];
  const start = performance.now();
  let fired = 0;

  return new Promise((resolve) => {
    function frame(t) {
      const elapsed = t - start;
      while (fired < bursts && elapsed > (fired * duration * 0.55) / bursts) {
        const tx = w * (0.18 + Math.random() * 0.64);
        const ty = h * (0.14 + Math.random() * 0.32);
        rockets.push({ x: tx + (Math.random() - 0.5) * 40, y: h + 10, tx, ty, kind: KINDS[fired % KINDS.length] });
        fired++;
      }

      // Xóa mờ dần (giữ nền trong suốt) → tạo vệt đuôi
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';

      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.x += (r.tx - r.x) * 0.08;
        r.y += (r.ty - r.y) * 0.08;
        ctx.fillStyle = '#fff3c4';
        ctx.beginPath();
        ctx.arc(r.x, r.y, 2.4, 0, Math.PI * 2);
        ctx.fill();
        if (Math.abs(r.y - r.ty) < 6) {
          explode(r.x, r.y, r.kind);
          if (navigator.userActivation?.hasBeenActive !== false) navigator.vibrate?.(12);
          rockets.splice(i, 1);
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.vx *= 0.97;
        p.vy = p.vy * 0.97 + 0.045 * scale; // trọng lực
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        const alpha = p.glitter ? p.life * (0.4 + Math.random() * 0.6) : p.life;
        ctx.globalAlpha = Math.max(0, alpha);
        if (p.flash) {
          ctx.drawImage(flash(), p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
          continue;
        }
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.6 + p.life * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (elapsed < duration || particles.length || rockets.length) requestAnimationFrame(frame);
      else {
        canvas.remove();
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}
