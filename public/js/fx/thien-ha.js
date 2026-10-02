// Màn kết "Vũ trụ của tụi mình": thiên hà xoắn ốc 3D nghìn hạt sáng, xoay chậm.
// Tên, lời yêu và ảnh của hai bạn trôi quanh như các hành tinh. Kéo để xoay, chạm để toé tim.
import { el, motionCount } from '../core/dom.js';
import { handFamily } from '../core/fonts.js';
import { ensureFont, fxStage, glowDot, glowText, heartbeat, heartPoint, loadImages, polaroid } from './stage.js';

const hand = (s) => `700 ${s}px ${handFamily()}`;
const COLORS = ['#fff4dc', '#ffd6e2', '#ff9cbf', '#ff5c93', '#ffb36b', '#e7b6ff'];

/** opts: { name, sender, phrase, lines: string[], imageUrls: string[] } */
export async function play(opts) {
  const [images] = await Promise.all([loadImages(opts.imageUrls, 10), ensureFont([opts.phrase, opts.name, ...opts.lines].join(''))]);
  return fxStage({
    recordable: !opts.preview, // bản xem thử không cho lưu video (tính năng của thiệp đã trả tiền)
    className: 'fx-galaxy',
    hint: 'Kéo để xoay vũ trụ · chạm để thả tim',
    extra: [el('p', { class: 'fx-stage-title', text: opts.phrase })],
    setup: (view) => scene(view, opts, images),
  });
}

function gauss() {
  return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
}

function scene(view, opts, images) {
  const { ctx } = view;
  let R, D, F;
  const size = () => {
    R = Math.min(view.w * 0.62, view.h * 0.4);
    D = R * 2.4;
    F = D * 0.95;
  };
  size();

  // --- Hạt của thiên hà (toạ độ chuẩn hoá theo R để đổi kích thước màn hình không phải tạo lại)
  const N = motionCount(view.w * view.h > 500000 ? 3600 : 2600); // máy yếu bớt hạt cho mượt
  const stars = [];
  for (let i = 0; i < N; i++) {
    const arm = i % 3;
    const kind = i % 9; // 0: lõi sáng, 1–2: bụi sao rải đều cả đĩa, còn lại: nhánh xoắn
    let r, a, y;
    if (kind === 0) {
      r = Math.abs(gauss()) * 0.22;
      a = Math.random() * Math.PI * 2;
      y = gauss() * 0.08;
    } else if (kind <= 2) {
      r = 0.1 + Math.sqrt(Math.random()) * 0.95;
      a = Math.random() * Math.PI * 2;
      y = gauss() * 0.04;
    } else {
      r = 0.08 + Math.pow(Math.random(), 0.8) * 0.95;
      a = arm * ((Math.PI * 2) / 3) + r * 3.4 + gauss() * (0.55 - r * 0.2);
      r += gauss() * 0.04;
      y = gauss() * 0.05 * (1.2 - r);
    }
    stars.push({
      r,
      a,
      y,
      speed: 0.00009 / (0.25 + Math.abs(r)), // vòng trong quay nhanh hơn
      color: r < 0.15 ? 0 : r < 0.35 ? 1 : r < 0.6 ? 2 + (i % 2) : 3 + (i % 3),
      s: kind <= 2 ? 0.6 + Math.random() * 0.8 : 0.9 + Math.random() * 1.8,
      dust: kind > 0 && kind <= 2,
    });
  }
  const buckets = COLORS.map(() => []);
  for (const s of stars) buckets[s.color].push(s);

  // --- Nền sao lấp lánh (toạ độ màn hình 0..1)
  const sky = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random() * 1.4 + 0.3, p: Math.random() * 6, f: 0.001 + Math.random() * 0.002 }));
  const shooting = [];

  // --- Vật thể trôi quanh: chữ và ảnh
  // Câu chính đã hiện ở tiêu đề phía trên, quanh thiên hà chỉ thả vài câu ngắn để khỏi rối.
  const words = [`${opts.name} ơi`, ...opts.lines.slice(0, 3), `${opts.sender} 💞 ${opts.name}`, 'Mãi bên nhau'].filter(Boolean);
  const bodies = [];
  const textSprites = words.map((w, i) => glowText(w, { font: hand(34), size: 34, glow: i % 2 ? '#ff5c93' : '#ffb36b' }));
  // Chữ và ảnh xen kẽ, chia đều quanh vòng tròn, cao thấp khác nhau để ít chồng lên nhau.
  const items = [];
  for (let i = 0; i < Math.max(textSprites.length, images.length); i++) {
    if (textSprites[i]) items.push({ sprite: textSprites[i] });
    if (images[i]) items.push({ sprite: polaroid(images[i], 150), photo: true });
  }
  items.forEach((it, i) =>
    bodies.push({ ...it, r: 0.62 + (i % 3) * 0.2, a: (i / items.length) * Math.PI * 2, y: (i % 2 ? 0.22 : -0.22) + (i % 3) * 0.05, delay: 1600 + i * 200 }),
  );

  const coreGlow = glowDot('#ff7aa8', 256);
  const nebula = glowDot('#b8336a', 256);
  const heartSprite = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 200;
    const g = c.getContext('2d');
    g.translate(100, 104);
    g.beginPath();
    for (let t = 0; t <= Math.PI * 2 + 0.01; t += 0.05) {
      const p = heartPoint(t);
      g.lineTo(p.x * 80, p.y * 80);
    }
    const grad = g.createRadialGradient(-20, -30, 5, 0, 0, 100);
    grad.addColorStop(0, '#ffe0ea');
    grad.addColorStop(0.5, '#ff5c93');
    grad.addColorStop(1, '#c2185b');
    g.shadowColor = '#ff5c93';
    g.shadowBlur = 24;
    g.fillStyle = grad;
    g.fill();
    return c;
  })();

  // --- Camera
  let yaw = 0;
  let yawVel = 0;
  let pitch = 1.05;
  const pops = []; // tim nhỏ toé ra khi chạm

  function project(x, y, z, out) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const x1 = x * cy - z * sy;
    const z1 = x * sy + z * cy;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const y2 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    const s = F / (D + z2);
    out.x = view.w / 2 + x1 * s;
    out.y = view.h * 0.5 + y2 * s;
    out.s = s;
    out.z = z2;
    return out;
  }

  const tmp = { x: 0, y: 0, s: 0, z: 0 };
  const easeOut = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

  return {
    resize: size,
    tap(x, y) {
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = 1 + Math.random() * 3;
        pops.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, life: 1, s: 8 + Math.random() * 10 });
      }
    },
    lighten() {
      // Giữ một nửa số sao, sao còn lại to hơn chút để thiên hà vẫn dày.
      for (const list of buckets) {
        const keep = list.filter((_, i) => i % 2 === 0);
        for (const s of keep) s.s *= 1.2;
        list.splice(0, list.length, ...keep);
      }
    },
    draw(t, dt) {
      const p = view.pointer;
      yawVel += p.dx * 0.00012 * dt;
      pitch = Math.min(1.45, Math.max(0.2, pitch + p.dy * 0.004));
      yaw += yawVel + 0.00012 * dt;
      yawVel *= 0.92;

      ctx.clearRect(0, 0, view.w, view.h);
      // Nền sao
      ctx.fillStyle = '#fff';
      for (const s of sky) {
        ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(s.p + t * s.f));
        ctx.fillRect(s.x * view.w, s.y * view.h, s.s, s.s);
      }
      // Sao băng
      if (Math.random() < dt / 2600) shooting.push({ x: Math.random() * view.w, y: Math.random() * view.h * 0.4, life: 1 });
      ctx.globalAlpha = 1;
      for (let i = shooting.length - 1; i >= 0; i--) {
        const s = shooting[i];
        s.x += dt * 0.9;
        s.y += dt * 0.35;
        s.life -= dt / 900;
        if (s.life <= 0) {
          shooting.splice(i, 1);
          continue;
        }
        const g = ctx.createLinearGradient(s.x, s.y, s.x - 90, s.y - 35);
        g.addColorStop(0, `rgba(255,255,255,${s.life})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - 90, s.y - 35);
        ctx.stroke();
      }

      // Vụ nổ lớn: các hạt bung ra từ tâm trong 2,6 giây đầu
      const bang = easeOut(t / 2600);
      const swirl = (1 - bang) * 4;
      ctx.globalCompositeOperation = 'lighter';
      // Tinh vân mờ: đĩa sáng hồng dẹt theo góc nghiêng
      project(0, 0, 0, tmp);
      const nw = R * 2.3 * tmp.s * bang;
      const nh = nw * Math.max(0.25, Math.cos(pitch));
      ctx.globalAlpha = 0.28;
      ctx.drawImage(nebula, tmp.x - nw / 2, tmp.y - nh / 2, nw, nh);
      for (let b = 0; b < buckets.length; b++) {
        ctx.fillStyle = COLORS[b];
        for (const s of buckets[b]) {
          const a = s.a + t * s.speed + swirl;
          const r = s.r * R * bang;
          project(Math.cos(a) * r, s.y * R, Math.sin(a) * r, tmp);
          const sz = s.s * tmp.s;
          ctx.globalAlpha = s.dust ? 0.35 : Math.min(1, 0.4 + tmp.s * 0.6);
          ctx.fillRect(tmp.x, tmp.y, sz, sz);
        }
      }
      // Lõi sáng + trái tim đập ở giữa
      const beat = heartbeat(t);
      project(0, 0, 0, tmp);
      const cs = R * 1.3 * tmp.s * (0.9 + beat * 0.12);
      ctx.globalAlpha = 0.85;
      ctx.drawImage(coreGlow, tmp.x - cs / 2, tmp.y - cs / 2, cs, cs);
      ctx.globalCompositeOperation = 'source-over';
      const hs = R * 0.34 * (1 + beat * 0.14) * Math.min(1, t / 1800);
      ctx.globalAlpha = 1;
      if (hs > 1) ctx.drawImage(heartSprite, tmp.x - hs / 2, tmp.y - hs / 2 - R * 0.05, hs, hs);

      // Chữ và ảnh: sắp xếp xa trước gần sau
      const list = [];
      for (const b of bodies) {
        if (t < b.delay) continue;
        const a = b.a + t * 0.00011;
        const r = b.r * R;
        const bob = Math.sin(t * 0.0012 + b.a * 3) * 0.03;
        project(Math.cos(a) * r, (b.y + bob) * R, Math.sin(a) * r, tmp);
        list.push({ b, x: tmp.x, y: tmp.y, s: tmp.s, z: tmp.z, in: Math.min(1, (t - b.delay) / 900) });
      }
      list.sort((m, n) => n.z - m.z);
      for (const it of list) {
        const sp = it.b.sprite;
        const k = (it.b.photo ? 0.42 : 0.5) * it.s * (0.6 + 0.4 * it.in) * Math.min(1.15, view.w / 420);
        const w = sp.width * k;
        const h = sp.height * k;
        ctx.globalAlpha = it.in * Math.max(0.25, Math.min(1, 1.2 - it.z / R));
        ctx.drawImage(sp, it.x - w / 2, it.y - h / 2, w, h);
      }

      // Tim toé ra khi chạm
      ctx.globalAlpha = 1;
      for (let i = pops.length - 1; i >= 0; i--) {
        const q = pops[i];
        q.x += q.vx;
        q.y += q.vy;
        q.vy += 0.06;
        q.life -= dt / 1100;
        if (q.life <= 0) {
          pops.splice(i, 1);
          continue;
        }
        const s = q.s * q.life;
        ctx.globalAlpha = q.life;
        ctx.drawImage(heartSprite, q.x - s / 2, q.y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
    },
  };
}
