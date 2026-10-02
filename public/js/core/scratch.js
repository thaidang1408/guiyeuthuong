// Thẻ cào: một lớp bạc phủ lên lời bí mật, người xem dùng ngón tay cào để lộ ra.
import { el, prefersReducedMotion } from './dom.js';

/**
 * text: nội dung bí mật. label: chữ trên lớp bạc. onReveal: gọi khi đã cào đủ.
 * Trả về phần tử để chèn vào trang.
 */
export function scratchCard({ text, label = 'Cào để xem bí mật 🪙', onReveal } = {}) {
  const secret = el('p', { class: 'scratch-text', text });
  const canvas = el('canvas', { class: 'scratch-cover', attrs: { 'aria-label': 'Lớp cào, dùng ngón tay cào để xem' } });
  const skip = el('button', { class: 'scratch-skip', text: 'Không cào được? Bấm để xem', attrs: { type: 'button' } });
  const box = el('div', { class: 'scratch' }, [secret, canvas]);
  const wrap = el('div', { class: 'scratch-wrap' }, [box, skip]);
  let done = false;
  let ctx = null;
  let moves = 0;

  const reveal = () => {
    if (done) return;
    done = true;
    canvas.classList.add('gone');
    skip.remove();
    navigator.vibrate?.(30);
    onReveal?.();
  };
  skip.addEventListener('click', reveal);

  const init = () => {
    const w = box.clientWidth;
    const h = box.clientHeight;
    if (!w || !h) return requestAnimationFrame(init); // chưa gắn vào trang
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#c9c9d1');
    g.addColorStop(0.5, '#eeeef2');
    g.addColorStop(1, '#b8b8c2');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#6b6b78';
    ctx.font = '600 17px "Be Vietnam Pro", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, w / 2, h / 2);
    ctx.globalCompositeOperation = 'destination-out';
    if (prefersReducedMotion()) skip.textContent = 'Bấm để xem bí mật';
  };
  requestAnimationFrame(init);

  /** Tỉ lệ đã cào (lấy mẫu thưa cho nhẹ). */
  const cleared = () => {
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let clear = 0;
    let total = 0;
    for (let i = 3; i < data.length; i += 4 * 37) {
      total++;
      if (data[i] === 0) clear++;
    }
    return clear / total;
  };

  let last = null;
  const scratchAt = (e) => {
    if (!ctx || done) return;
    const r = canvas.getBoundingClientRect();
    const p = { x: e.clientX - r.left, y: e.clientY - r.top };
    ctx.lineWidth = 34;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo((last || p).x, (last || p).y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last = p;
    if (++moves % 12 === 0 && cleared() > 0.5) reveal();
  };
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture?.(e.pointerId);
    last = null;
    scratchAt(e);
  });
  canvas.addEventListener('pointermove', (e) => e.buttons && scratchAt(e));
  canvas.addEventListener('pointerup', () => (last = null));

  return wrap;
}
