// Màn kết "Tên em bằng ngàn vì sao": bầu trời đầy sao, rồi từng ngôi sao bay về xếp thành tên người nhận
// và câu yêu thương, sau đó tan ra thành trái tim, rồi lại thành tên… Chạm/rê tay vào là sao tung ra.
import { handFamily } from '../core/fonts.js';
import { sfx } from '../core/sfx.js';
import { ensureFont, fxStage, glowDot, heartPoint } from './stage.js';

const COLORS = ['#fff7d6', '#ffe08a', '#ffc2d6', '#ff8fb3', '#ffffff'];
const MAX = 2400;

/** opts: { name, phrase } */
export async function play(opts) {
  await ensureFont(opts.name + opts.phrase);
  return fxStage({
    recordable: !opts.preview, // bản xem thử không cho lưu video (tính năng của thiệp đã trả tiền)
    className: 'fx-stars',
    hint: 'Chạm hoặc vuốt qua tên nhé ✨',
    setup: (view) => scene(view, opts),
  });
}

/** Vẽ chữ ra canvas tạm rồi lấy toạ độ các điểm có màu làm đích cho sao. */
function textTargets(w, h, name, phrase) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = Math.min(150, h * 0.2);
  g.font = `700 ${size}px ${handFamily()}`;
  while (g.measureText(name).width > w * 0.86 && size > 30) {
    size -= 4;
    g.font = `700 ${size}px ${handFamily()}`;
  }
  g.fillText(name, w / 2, h * 0.4);
  // Câu phụ dùng chữ đậm không chân để khi ghép bằng chấm sao vẫn đọc rõ.
  let ps = Math.max(22, Math.min(34, size * 0.32));
  const sub = (n) => `800 ${n}px 'Be Vietnam Pro', sans-serif`;
  g.font = sub(ps);
  while (g.measureText(phrase).width > w * 0.92 && ps > 16) {
    ps -= 1;
    g.font = sub(ps);
  }
  g.fillText(phrase, w / 2, h * 0.4 + size * 0.75 + ps * 0.5);
  const data = g.getImageData(0, 0, w, h).data;
  let gap = 2;
  let pts;
  do {
    pts = [];
    for (let y = 0; y < h; y += gap) for (let x = 0; x < w; x += gap) if (data[(y * w + x) * 4 + 3] > 128) pts.push({ x, y });
    gap++;
  } while (pts.length > MAX && gap < 12);
  return pts;
}

function heartTargets(w, h, n) {
  const S = Math.min(w * 0.4, h * 0.26);
  return Array.from({ length: n }, (_, i) => {
    const p = heartPoint((i / n) * Math.PI * 2 * 7.13);
    const k = i % 4 === 0 ? 1 : 1 - Math.random() * 0.5 * Math.random();
    return { x: w / 2 + p.x * S * k, y: h * 0.44 + p.y * S * k };
  });
}

function scene(view, opts) {
  const { ctx } = view;
  let shapes;
  let parts = [];
  const sky = Array.from({ length: 120 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random() * 1.3 + 0.3, p: Math.random() * 6 }));
  const bigStar = glowDot('#ffe08a', 48);

  function build() {
    const text = textTargets(Math.round(view.w), Math.round(view.h), opts.name, opts.phrase);
    const n = Math.max(text.length, 600);
    shapes = [text, heartTargets(view.w, view.h, n)];
    const old = parts;
    parts = Array.from({ length: n }, (_, i) => old[i] || {
      x: Math.random() * view.w,
      y: Math.random() * view.h,
      vx: 0,
      vy: 0,
      c: i % COLORS.length,
      s: 1 + Math.random() * 1.6,
      tw: Math.random() * 6,
      delay: 900 + Math.random() * 1600,
      big: i % 37 === 0,
    });
  }
  build();

  const shooting = [];
  let shapeIdx = -1;

  return {
    resize: build,
    draw(t, dt) {
      // Lịch: 0–0,9s bầu trời sao → tên (8s) → trái tim (4s) → tên…
      const cycle = (t - 900) % 12000;
      const want = t < 900 ? -1 : cycle < 8000 ? 0 : 1;
      if (want !== shapeIdx) {
        shapeIdx = want;
        if (want === 0) setTimeout(() => (sfx.sparkle(10), sfx.chime(0.12)), 1200);
        if (want === 1) sfx.whoosh();
        if (want === 1) for (const q of parts) (q.vx += (Math.random() - 0.5) * 6), (q.vy += (Math.random() - 0.5) * 6);
      }
      const targets = shapeIdx >= 0 ? shapes[shapeIdx] : null;
      const ptr = view.pointer;

      ctx.clearRect(0, 0, view.w, view.h);
      ctx.fillStyle = '#fff';
      for (const s of sky) {
        ctx.globalAlpha = 0.25 + 0.5 * Math.abs(Math.sin(s.p + t * 0.0015));
        ctx.fillRect(s.x * view.w, s.y * view.h, s.s, s.s);
      }
      if (Math.random() < dt / 2200) shooting.push({ x: Math.random() * view.w * 0.8, y: Math.random() * view.h * 0.3, life: 1 });
      ctx.strokeStyle = '#fff';
      for (let i = shooting.length - 1; i >= 0; i--) {
        const s = shooting[i];
        s.x += dt * 0.8;
        s.y += dt * 0.3;
        s.life -= dt / 800;
        if (s.life <= 0) {
          shooting.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = s.life;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - 70 * s.life, s.y - 26 * s.life);
        ctx.stroke();
      }

      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < parts.length; i++) {
        const q = parts[i];
        if (targets && t > q.delay) {
          const tg = targets[i % targets.length];
          // Lò xo có giảm chấn: bay tới đích, hơi vượt rồi dừng lại.
          q.vx += (tg.x - q.x) * 0.012;
          q.vy += (tg.y - q.y) * 0.012;
        } else {
          q.vx += Math.sin(t * 0.0007 + i) * 0.01;
          q.vy += Math.cos(t * 0.0006 + i) * 0.01;
        }
        // Ngón tay đẩy sao ra xa
        const dx = q.x - ptr.x;
        const dy = q.y - ptr.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 6400) {
          const d = Math.sqrt(d2) || 1;
          q.vx += (dx / d) * (80 - d) * 0.09;
          q.vy += (dy / d) * (80 - d) * 0.09;
        }
        q.vx *= 0.86;
        q.vy *= 0.86;
        q.x += q.vx;
        q.y += q.vy;
        const tw = 0.45 + 0.55 * Math.abs(Math.sin(q.tw + t * 0.003));
        ctx.globalAlpha = tw;
        if (q.big) {
          const s = 14 * tw;
          ctx.drawImage(bigStar, q.x - s / 2, q.y - s / 2, s, s);
        } else {
          ctx.fillStyle = COLORS[q.c];
          ctx.fillRect(q.x, q.y, q.s, q.s);
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    },
  };
}
