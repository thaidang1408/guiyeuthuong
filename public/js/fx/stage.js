// Khung toàn màn hình cho các "màn kết" đặc biệt: canvas nét theo màn hình (tối đa 2x),
// vòng lặp vẽ tự dừng khi tab ẩn, nút "Tiếp tục" để đóng, hỗ trợ kéo/chạm.
import { el, liteDevice, prefersReducedMotion } from '../core/dom.js';
import { handFamily } from '../core/fonts.js';
import { sfx } from '../core/sfx.js';

/**
 * setup({ canvas, ctx, w, h, dpr, pointer }) trả về { draw(t, dt), resize?(), destroy?(), lighten?() }.
 * lighten(): máy vẽ không kịp thì cảnh tự bớt một nửa số hạt (gọi một lần).
 * pointer: { x, y, down, dx, dy } — dx/dy là quãng kéo cộng dồn từ khung trước (đọc xong tự về 0).
 * Trả về Promise, xong khi người xem bấm "Tiếp tục".
 */
export function fxStage({ hint = '', className = '', extra = [], setup, recordable = true }) {
  const canvas = el('canvas', { class: 'fx-stage-canvas', attrs: { 'aria-hidden': 'true' } });
  const close = el('button', { class: 'btn btn-primary fx-stage-close', text: 'Tiếp tục ↓', attrs: { type: 'button' } });
  const overlay = el('div', { class: `fx-stage ${className}`, attrs: { role: 'dialog', 'aria-label': 'Bất ngờ cuối thiệp' } }, [
    canvas,
    ...extra,
    hint ? el('p', { class: 'fx-stage-hint', text: hint }) : null,
    close,
  ]);
  const canRecord = recordable && !!canvas.captureStream && typeof MediaRecorder !== 'undefined' && !!pickVideoType();
  if (canRecord) overlay.append(el('button', { class: 'btn btn-soft btn-sm fx-stage-rec', text: '🎥 Lưu video 8 giây', attrs: { type: 'button' }, on: { click: () => record() } }));
  document.body.append(overlay);
  document.body.classList.add('fx-stage-open');

  const ctx = canvas.getContext('2d');
  // Máy yếu bắt đầu ở 1,5x; máy thường 2x rồi tự hạ nếu vẽ không kịp (xem quality bên dưới).
  const view = { canvas, ctx, w: 0, h: 0, dpr: Math.min(window.devicePixelRatio || 1, liteDevice() ? 1.5 : 2), pointer: { x: -9999, y: -9999, down: false, dx: 0, dy: 0 } };
  const resize = () => {
    view.w = overlay.clientWidth;
    view.h = overlay.clientHeight;
    canvas.width = Math.round(view.w * view.dpr);
    canvas.height = Math.round(view.h * view.dpr);
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    scene?.resize?.();
  };
  let scene = null;
  resize();
  scene = setup(view);

  // Kéo/chạm: dùng pointer events để chạy giống nhau trên điện thoại và máy tính.
  const p = view.pointer;
  let last = null;
  canvas.addEventListener('pointerdown', (e) => {
    p.down = true;
    p.x = e.clientX;
    p.y = e.clientY;
    last = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture?.(e.pointerId);
    if (scene.tap) {
      scene.tap(e.clientX, e.clientY);
      sfx.sparkle(4);
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    p.x = e.clientX;
    p.y = e.clientY;
    if (p.down && last) {
      p.dx += e.clientX - last.x;
      p.dy += e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
    }
  });
  const up = () => {
    p.down = false;
    last = null;
    if (!matchMedia('(hover: hover)').matches) p.x = p.y = -9999;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', up);

  const reduced = prefersReducedMotion();
  let raf = 0;
  let prev = 0;
  let elapsed = 0;
  // Tự chỉnh chất lượng: đo 45 khung một lần (bỏ 1 giây đầu lúc đang tải). Trung bình chậm hơn ~52 khung/giây
  // thì giảm tải theo thứ tự: bớt một nửa số hạt (một lần) → hạ độ nét 2x → 1,5x.
  // Hình bớt chi tiết một chút nhưng hết khựng — điều người xem thấy rõ hơn nhiều.
  const quality = { n: 0, sum: 0, lightened: 0 };
  const adapt = (dt) => {
    if (elapsed < 1000) return;
    quality.sum += dt;
    if (++quality.n < 45) return;
    const avg = quality.sum / quality.n;
    quality.n = quality.sum = 0;
    if (avg <= 19) return;
    if (scene.lighten && quality.lightened < 1) {
      quality.lightened++;
      scene.lighten();
    } else if (view.dpr > 1.5) {
      view.dpr = 1.5;
      resize();
    }
  };
  const frame = (now) => {
    const dt = Math.min(50, prev ? now - prev : 16);
    prev = now;
    elapsed += dt;
    adapt(dt);
    scene.draw(elapsed, dt);
    rec?.draw();
    p.dx = p.dy = 0;
    raf = requestAnimationFrame(frame);
  };
  const play = () => {
    if (raf) return;
    prev = 0;
    raf = requestAnimationFrame(frame);
  };
  const pause = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };
  // Giảm chuyển động: chỉ vẽ một khung ở trạng thái hoàn chỉnh.
  if (reduced) scene.draw(60000, 16);
  else play();
  const onVis = () => (document.hidden ? pause() : !reduced && play());
  document.addEventListener('visibilitychange', onVis);
  addEventListener('resize', resize);
  requestAnimationFrame(() => overlay.classList.add('shown'));
  sfx.magic();

  // --- Quay video: ghép canvas hiệu ứng + chữ + tên web vào một canvas riêng rồi ghi lại 8 giây.
  let rec = null;
  async function record() {
    if (rec) return;
    const btn = overlay.querySelector('.fx-stage-rec');
    const scale = Math.min(view.dpr, 1.5);
    const out = document.createElement('canvas');
    out.width = Math.round(view.w * scale);
    out.height = Math.round(view.h * scale);
    const g = out.getContext('2d');
    const texts = [...overlay.querySelectorAll('.fx-stage-title, .fx-stage-sign')].map((n) => ({ n, text: n.textContent }));
    const type = pickVideoType();
    const chunks = [];
    const recorder = new MediaRecorder(out.captureStream(30), { mimeType: type, videoBitsPerSecond: 4000000 });
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const started = performance.now();
    rec = {
      draw() {
        const grad = g.createRadialGradient(out.width / 2, out.height * 0.45, 0, out.width / 2, out.height * 0.45, out.height * 0.7);
        grad.addColorStop(0, '#2a0a1f');
        grad.addColorStop(0.55, '#12040e');
        grad.addColorStop(1, '#05010a');
        g.fillStyle = grad;
        g.fillRect(0, 0, out.width, out.height);
        g.drawImage(canvas, 0, 0, out.width, out.height);
        g.save();
        g.scale(scale, scale);
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = '#fff';
        g.shadowColor = '#ff5c93';
        g.shadowBlur = 16;
        for (const { n, text } of texts) {
          const r = n.getBoundingClientRect();
          const cs = getComputedStyle(n);
          g.globalAlpha = Number(cs.opacity) || 0;
          g.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
          g.fillText(text, r.left + r.width / 2, r.top + r.height / 2, view.w - 24);
        }
        // Tên web ở cuối video: người xem story biết tạo ở đâu.
        g.globalAlpha = 0.85;
        g.shadowBlur = 6;
        g.font = "600 13px 'Be Vietnam Pro', sans-serif";
        g.fillText(`💌 Tạo thiệp như này tại ${location.host}`, view.w / 2, view.h - 22);
        g.restore();
        const left = Math.ceil(8 - (performance.now() - started) / 1000);
        if (left > 0) btn.textContent = `⏺ Đang quay… ${left}s`;
      },
    };
    btn.disabled = true;
    recorder.start(500);
    await new Promise((r) => setTimeout(r, 8000));
    await new Promise((r) => {
      recorder.onstop = r;
      recorder.stop();
    });
    rec = null;
    const blob = new Blob(chunks, { type: type.split(';')[0] });
    const file = new File([blob], `thiep-yeu-thuong.${type.includes('mp4') ? 'mp4' : 'webm'}`, { type: blob.type });
    const url = URL.createObjectURL(blob);
    const actions = [el('a', { class: 'btn btn-soft btn-sm', text: '⬇️ Tải video', attrs: { href: url, download: file.name } })];
    if (navigator.canShare?.({ files: [file] })) {
      actions.unshift(el('button', { class: 'btn btn-primary btn-sm', text: '📤 Đăng story / TikTok', attrs: { type: 'button' }, on: { click: () => navigator.share({ files: [file] }).catch(() => {}) } }));
    }
    btn.replaceWith(el('div', { class: 'fx-stage-rec fx-stage-rec-done' }, actions));
  }

  return new Promise((resolve) => {
    close.addEventListener('click', () => {
      pause();
      document.removeEventListener('visibilitychange', onVis);
      removeEventListener('resize', resize);
      scene.destroy?.();
      overlay.classList.remove('shown');
      document.body.classList.remove('fx-stage-open');
      setTimeout(() => overlay.remove(), 450);
      resolve();
    });
    setTimeout(() => close.classList.add('ready'), reduced ? 0 : 2500);
  });
}

/** Định dạng video trình duyệt quay được; ưu tiên MP4 (đăng TikTok/Zalo dễ hơn). */
function pickVideoType() {
  if (typeof MediaRecorder === 'undefined') return '';
  return ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

/** Chữ phát sáng vẽ sẵn ra canvas riêng (vẽ glow mỗi khung rất tốn, nên chỉ vẽ một lần). */
export function glowText(text, { font, color = '#fff', glow = '#ff4d8d', blur = 18, size = 32 }) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const f = `${font.includes('px') ? font : `${font} ${size}px`}`;
  g.font = f;
  const w = Math.ceil(g.measureText(text).width) + blur * 4;
  const h = Math.ceil(size * 1.5) + blur * 4;
  c.width = w;
  c.height = h;
  g.font = f;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = glow;
  g.shadowBlur = blur;
  g.fillStyle = color;
  g.fillText(text, w / 2, h / 2);
  g.shadowBlur = blur / 3;
  g.fillText(text, w / 2, h / 2);
  return c;
}

/** Chấm sáng tròn mờ dần (dùng chung cho lõi thiên hà, quầng trái tim...). */
export function glowDot(color, size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.2, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

/** Tải ảnh (blob URL hoặc /api/img/...). Ảnh lỗi thì bỏ qua. */
export function loadImages(urls, max = 12) {
  return Promise.all(
    urls.slice(0, max).map(
      (src) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = src;
        }),
    ),
  ).then((list) => list.filter(Boolean));
}

/** Ảnh vuông bo góc có viền trắng, vẽ sẵn để xoay/thu phóng cho nhẹ. */
export function polaroid(img, size = 150) {
  const c = document.createElement('canvas');
  const pad = 8;
  c.width = c.height = size + pad * 2;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.beginPath();
  g.roundRect?.(0, 0, c.width, c.height, 14) ?? g.rect(0, 0, c.width, c.height);
  g.fill();
  const s = Math.min(img.naturalWidth, img.naturalHeight);
  g.save();
  g.beginPath();
  g.roundRect?.(pad, pad, size, size, 10) ?? g.rect(pad, pad, size, size);
  g.clip();
  g.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, pad, pad, size, size);
  g.restore();
  return c;
}

/** Điểm trên đường viền trái tim, t ∈ [0, 2π). Trả về x ∈ [-1, 1], y hướng xuống (toạ độ màn hình). */
export function heartPoint(t) {
  const x = 16 * Math.sin(t) ** 3;
  const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
  return { x: x / 16, y: -y / 16 };
}

/** Nhịp tim "thình thịch" (2 nhịp gần nhau rồi nghỉ). Trả về 0..1. */
export function heartbeat(t, period = 1100) {
  const p = (t % period) / period;
  const pulse = (c, wdt) => Math.max(0, 1 - Math.abs(p - c) / wdt);
  return Math.max(pulse(0.08, 0.08), 0.7 * pulse(0.28, 0.08));
}

/** Chờ font viết tay tải xong (tối đa 1,5 giây) để chữ vẽ lên canvas có dấu tiếng Việt đẹp. */
export function ensureFont(text = '') {
  if (!document.fonts?.load) return Promise.resolve();
  const loads = Promise.all([
    document.fonts.load(`700 40px ${handFamily()}`, text || 'Ơ'),
    document.fonts.load("600 20px 'Be Vietnam Pro'", text || 'Ơ'),
  ]).catch(() => {});
  return Promise.race([loads, new Promise((r) => setTimeout(r, 1500))]);
}
