// /chu-roi — công cụ miễn phí: "mưa chữ" tỏ tình kèm tên người ấy. Dữ liệu nằm trong link (?t=…&n=…).
// Vẽ bằng canvas, chữ người dùng nhập chỉ được vẽ lên canvas hoặc gán bằng textContent.
import { calmMotion, canvasDpr, copyText, el, prefersReducedMotion, qs } from '../core/dom.js';

const app = qs('#app');
const clip = (s, n) => [...String(s ?? '').trim()].slice(0, n).join('');

function rain(canvas, words) {
  const ctx = canvas.getContext('2d');
  const dpr = canvasDpr();
  let drops = [];
  const resize = () => {
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cols = Math.max(6, Math.floor(innerWidth / 70));
    drops = Array.from({ length: cols * 2 }, (_, i) => ({
      x: ((i % cols) + Math.random() * 0.6) * (innerWidth / cols),
      y: Math.random() * -innerHeight,
      speed: (0.6 + Math.random() * 1.6) * (calmMotion() ? 0.5 : 1), // máy bật giảm chuyển động: rơi chậm hơn
      size: 13 + Math.random() * 12,
      word: words[i % words.length],
      hue: 330 + Math.random() * 30,
    }));
  };
  resize();
  addEventListener('resize', resize);
  const draw = () => {
    ctx.fillStyle = 'rgba(26, 11, 20, 0.22)';
    ctx.fillRect(0, 0, innerWidth, innerHeight);
    for (const d of drops) {
      ctx.font = `600 ${d.size}px "Be Vietnam Pro", sans-serif`;
      ctx.fillStyle = `hsla(${d.hue}, 90%, ${60 + d.size}%, 0.9)`;
      ctx.shadowColor = `hsl(${d.hue}, 90%, 60%)`;
      ctx.shadowBlur = 10;
      ctx.fillText(d.word, d.x, d.y);
      d.y += d.speed * (d.size / 10);
      if (d.y > innerHeight + 30) {
        d.y = -20 - Math.random() * 200;
        d.x = Math.random() * innerWidth;
      }
    }
    ctx.shadowBlur = 0;
    if (!prefersReducedMotion()) requestAnimationFrame(draw);
  };
  if (prefersReducedMotion()) {
    for (const d of drops) d.y = Math.random() * innerHeight;
  }
  draw();
}

function showRain(text, name, isOwner) {
  document.body.classList.add('rain-mode');
  const canvas = el('canvas', { class: 'rain-canvas', attrs: { 'aria-hidden': 'true' } });
  const words = [text, '💗', name ? `${name} ơi` : 'thương', '♥', text];
  const params = new URLSearchParams({ t: text, ...(name ? { n: name } : {}) });
  const link = `${location.origin}${location.pathname}?${params}`;
  app.replaceChildren(
    canvas,
    el('div', { class: 'rain-center' }, [
      name ? el('p', { class: 'rain-name hand', text: `Gửi ${name},` }) : null,
      el('h1', { class: 'rain-text', text }),
      isOwner
        ? el('div', { class: 'share-actions rain-actions' }, [
            el('button', { class: 'btn btn-primary btn-sm', text: '📋 Sao chép link', attrs: { type: 'button' }, on: { click: () => copyText(link) } }),
            navigator.share
              ? el('button', { class: 'btn btn-soft btn-sm', text: '📤 Gửi', attrs: { type: 'button' }, on: { click: () => navigator.share({ title: 'Có người gửi bạn một cơn mưa chữ 💗', url: link }).catch(() => {}) } })
              : null,
          ])
        : null,
      el('div', { class: 'rain-upsell' }, [
        el('p', { class: 'small', text: 'Muốn có nút "Không" bỏ chạy, pháo hoa và ảnh kỷ niệm?' }),
        el('a', { class: 'btn btn-ghost btn-sm', text: '💘 Tạo thiệp tỏ tình xịn', attrs: { href: '/xem-truoc?demo=to-tinh' } }),
      ]),
    ]),
  );
  rain(canvas, words);
}

function showForm() {
  const text = el('input', { class: 'input', attrs: { maxlength: '40', placeholder: 'Ví dụ: Anh yêu em, Em thương anh…', required: '' } });
  text.value = 'Thương cậu nhiều lắm';
  const name = el('input', { class: 'input', attrs: { maxlength: '30', placeholder: 'Ví dụ: Ẻm, Người ấy… (không bắt buộc)' } });
  const form = el('form', { class: 'panel' }, [
    el('label', { class: 'field' }, [el('span', { class: 'field-label', text: 'Câu muốn nói' }), text]),
    el('label', { class: 'field' }, [el('span', { class: 'field-label', text: 'Tên người ấy' }), name]),
    el('button', { class: 'btn btn-primary', text: 'Tạo mưa chữ 💗', attrs: { type: 'submit' } }),
  ]);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const t = clip(text.value, 40);
    if (!t) return text.focus();
    showRain(t, clip(name.value, 30), true);
  });
  app.append(form);
}

const q = new URLSearchParams(location.search);
if (q.get('t')) showRain(clip(q.get('t'), 40), clip(q.get('n'), 30), false);
else showForm();
