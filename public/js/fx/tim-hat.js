// Màn kết "Trái tim nghìn hạt sáng": trái tim 3D ghép từ hàng nghìn hạt, đập "thình thịch",
// hạt quầng bên ngoài lấp lánh liên tục. Tên người nhận phát sáng ở giữa. Chạm để tạo sóng xung kích.
import { el, motionCount } from '../core/dom.js';
import { handFamily } from '../core/fonts.js';
import { sfx } from '../core/sfx.js';
import { ensureFont, fxStage, glowText, heartbeat, heartPoint } from './stage.js';

const COLORS = ['#ffd1df', '#ff8fb3', '#ff5c93', '#ff2d6f', '#ffb3c8'];

/** opts: { name, sender, phrase } */
export async function play(opts) {
  await ensureFont(opts.name + opts.phrase);
  return fxStage({
    recordable: !opts.preview, // bản xem thử không cho lưu video (tính năng của thiệp đã trả tiền)
    className: 'fx-heart',
    hint: 'Kéo để xoay · chạm vào trái tim nhé',
    extra: [el('p', { class: 'fx-stage-sign', text: `— ${opts.sender} —` })],
    setup: (view) => scene(view, opts),
  });
}

function scene(view, opts) {
  const { ctx } = view;
  let lastBeat = -1;
  let S;
  const size = () => (S = Math.min(view.w * 0.42, view.h * 0.27));
  size();

  const many = view.w * view.h > 500000;
  const body = [];
  const BODY = motionCount(many ? 4200 : 3200); // máy yếu bớt hạt cho mượt
  for (let i = 0; i < BODY; i++) {
    const p = heartPoint(sampleT());
    // Dày đặc ở viền, thưa dần vào trong (phân bố mũ).
    const k = i % 5 === 0 ? Math.sqrt(Math.random()) : Math.max(0, 1 - Math.min(1, -0.09 * Math.log(Math.random())));
    const x = p.x * k;
    const y = p.y * k;
    const d = Math.hypot(x, y);
    body.push({ x, y, z: (Math.random() - 0.5) * 0.7 * Math.sqrt(Math.max(0, 1 - d * d * 0.8)), c: i % COLORS.length, s: 1.1 + Math.random() * 1.5 });
  }
  const HALO = motionCount(many ? 1100 : 750);
  const halo = Array.from({ length: HALO }, (_, i) => {
    const t = sampleT();
    return { t, k: 1 + Math.min(0.5, -0.07 * Math.log(Math.random())), c: i % COLORS.length };
  });
  const buckets = COLORS.map(() => []);
  for (const b of body) buckets[b.c].push(b);

  const floaters = Array.from({ length: 22 }, () => newFloater(true));
  function newFloater(anywhere) {
    return { x: Math.random(), y: anywhere ? Math.random() : 1.05, v: 0.00004 + Math.random() * 0.00006, s: 6 + Math.random() * 12, w: Math.random() * 6 };
  }

  const glow = glowHeart();
  const nameSprite = glowText(opts.name, { font: `700 54px ${handFamily()}`, size: 54, glow: '#ff2d6f', blur: 22 });
  const phraseSprite = glowText(opts.phrase, { font: "600 {s}px 'Be Vietnam Pro', sans-serif".replace('{s}', 20), size: 20, glow: '#ff5c93', blur: 12 });

  let yaw = 0;
  let yawVel = 0;
  const shocks = [];
  const tmp = { x: 0, y: 0, s: 1 };

  return {
    resize: size,
    lighten() {
      // Giữ một nửa số hạt, hạt còn lại to hơn chút để trái tim vẫn dày.
      for (const list of buckets) {
        const keep = list.filter((_, i) => i % 2 === 0);
        for (const q of keep) q.s *= 1.2;
        list.splice(0, list.length, ...keep);
      }
      halo.splice(0, halo.length, ...halo.filter((_, i) => i % 2 === 0));
    },
    tap(x, y) {
      shocks.push({ x, y, t0: performance.now() });
      navigator.vibrate?.(15);
    },
    draw(t, dt) {
      yawVel += view.pointer.dx * 0.0001 * dt;
      yawVel *= 0.93;
      yaw += yawVel;
      const swing = Math.sin(t * 0.0006) * 0.45 + yaw;
      const cy = Math.cos(swing);
      const sy = Math.sin(swing);
      const beat = heartbeat(t);
      // Mỗi chu kỳ 1,1 giây một tiếng "thình thịch" (sau khi trái tim hiện rõ).
      const cycle = Math.floor(t / 1100);
      if (cycle !== lastBeat && t > 1500) sfx.heartbeat(0.45);
      lastBeat = cycle;
      const appear = Math.min(1, t / 1800);
      const cx = view.w / 2;
      const cyScr = view.h * 0.46;
      const now = performance.now();
      for (let i = shocks.length - 1; i >= 0; i--) if (now - shocks[i].t0 > 900) shocks.splice(i, 1);

      ctx.clearRect(0, 0, view.w, view.h);
      const gs = S * 2.9 * (1 + beat * 0.1) * appear;
      ctx.globalAlpha = 0.55 + beat * 0.3;
      ctx.drawImage(glow, cx - gs / 2, cyScr - gs / 2, gs, gs);
      ctx.globalCompositeOperation = 'lighter';

      const place = (x, y, z, push) => {
        const x1 = x * cy - z * sy;
        const z1 = x * sy + z * cy;
        const persp = 2.6 / (2.6 + z1);
        tmp.x = cx + x1 * S * persp * push;
        tmp.y = cyScr + y * S * persp * push;
        tmp.s = persp;
        // Sóng xung kích: hạt gần chỗ chạm bị đẩy ra rồi trở lại
        for (const sh of shocks) {
          const age = (now - sh.t0) / 900;
          const dx = tmp.x - sh.x;
          const dy = tmp.y - sh.y;
          const dist = Math.hypot(dx, dy) || 1;
          const ring = Math.abs(dist - age * 260);
          if (ring < 50) {
            const f = (1 - ring / 50) * 24 * (1 - age);
            tmp.x += (dx / dist) * f;
            tmp.y += (dy / dist) * f;
          }
        }
      };

      // Thân trái tim: đập mạnh hơn ở viền, hạt rung nhẹ để lấp lánh
      for (let b = 0; b < buckets.length; b++) {
        ctx.fillStyle = COLORS[b];
        for (const q of buckets[b]) {
          const d = Math.hypot(q.x, q.y);
          const push = (1 + beat * 0.1 * (0.5 + d)) * (0.3 + 0.7 * appear) + (appear < 1 ? (1 - appear) * (Math.random() - 0.5) : 0);
          place(q.x, q.y, q.z, push);
          const sz = q.s * tmp.s;
          ctx.globalAlpha = 0.55 + 0.45 * tmp.s - (tmp.s < 1 ? 0.25 : 0);
          ctx.fillRect(tmp.x + (Math.random() - 0.5) * 1.2, tmp.y + (Math.random() - 0.5) * 1.2, sz, sz);
        }
      }
      // Quầng hạt bên ngoài: nhấp nháy ngẫu nhiên mỗi khung
      for (const h of halo) {
        if (Math.random() < 0.35) continue;
        const p = heartPoint(h.t);
        const k = h.k * (1 + beat * 0.16) + (Math.random() - 0.5) * 0.04;
        place(p.x * k, p.y * k, 0, appear);
        ctx.fillStyle = COLORS[h.c];
        ctx.globalAlpha = Math.random() * 0.6;
        ctx.fillRect(tmp.x, tmp.y, 1.4, 1.4);
      }

      // Tim nhỏ bay lên
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#ff5c93';
      for (let i = 0; i < floaters.length; i++) {
        const f = floaters[i];
        f.y -= f.v * dt;
        if (f.y < -0.05) floaters[i] = newFloater(false);
        ctx.globalAlpha = 0.35 * Math.min(1, f.y * 3);
        drawHeart(ctx, f.x * view.w + Math.sin(t * 0.002 + f.w) * 10, f.y * view.h, f.s);
      }

      // Tên + câu ở giữa, phập phồng theo nhịp
      ctx.globalAlpha = Math.min(1, Math.max(0, (t - 1200) / 900));
      const ns = Math.min(1, (S * 1.25) / nameSprite.width) * (1 + beat * 0.06);
      ctx.drawImage(nameSprite, cx - (nameSprite.width * ns) / 2, cyScr - S * 0.12 - (nameSprite.height * ns) / 2, nameSprite.width * ns, nameSprite.height * ns);
      const ps = Math.min(1, (view.w * 0.9) / phraseSprite.width);
      ctx.globalAlpha = Math.min(1, Math.max(0, (t - 2000) / 900));
      ctx.drawImage(phraseSprite, cx - (phraseSprite.width * ps) / 2, cyScr + S * 1.2, phraseSprite.width * ps, phraseSprite.height * ps);
      ctx.globalAlpha = 1;
    },
  };
}

/** Lấy t sao cho điểm rải đều theo chiều dài đường viền (tránh dồn cục ở đỉnh và mũi trái tim). */
function sampleT() {
  for (;;) {
    const t = Math.random() * Math.PI * 2;
    const a = heartPoint(t);
    const b = heartPoint(t + 0.01);
    if (Math.random() * 0.016 < Math.hypot(b.x - a.x, b.y - a.y)) return t;
  }
}

/** Trái tim mờ phát sáng phía sau các hạt. */
function glowHeart() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.translate(128, 132);
  g.beginPath();
  for (let t = 0; t <= Math.PI * 2 + 0.01; t += 0.05) {
    const p = heartPoint(t);
    g.lineTo(p.x * 92, p.y * 92);
  }
  g.shadowColor = '#ff2d6f';
  g.shadowBlur = 40;
  g.fillStyle = 'rgba(255, 45, 111, 0.35)';
  g.fill();
  return c;
}

function drawHeart(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.3);
  ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s);
  ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
  ctx.fill();
}
