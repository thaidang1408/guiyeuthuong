// Màn kết "Trái tim kỷ niệm": từng tấm ảnh bay vào xếp thành trái tim lớn đang đập.
// Không có ảnh thì dùng ô màu có hình hoa/tim. Chạm vào một ô ảnh để xem to.
import { el } from '../core/dom.js';
import { sfx } from '../core/sfx.js';
import { fxStage } from './stage.js';

const EMOJI = ['💖', '🌸', '✨', '💌', '🌷', '💕', '🎀', '🌹', '💗', '⭐'];
const TINTS = ['#ffd1df', '#ffe7a8', '#ffc2d6', '#ffb3a7', '#fde2ff', '#ffdcc2'];

/** opts: { name, sender, phrase, imageUrls } */
export function play(opts) {
  const heart = el('div', { class: 'fx-photo-heart' });
  const caption = el('div', { class: 'fx-photo-caption' }, [
    el('p', { class: 'fx-photo-name', text: opts.name }),
    el('p', { class: 'fx-photo-phrase', text: opts.phrase }),
  ]);
  layout(heart, opts.imageUrls);
  return fxStage({
    className: 'fx-photos',
    hint: opts.imageUrls.length ? 'Chạm vào ảnh để xem to' : '',
    extra: [heart, caption],
    setup: (view) => bokeh(view),
    recordable: false, // ảnh nằm ngoài canvas nên video sẽ thiếu ảnh
  });
}

/** Ô lưới nằm trong trái tim: (x²+y²−1)³ − x²y³ ≤ 0. */
function cells() {
  const out = [];
  const cols = 9;
  const rows = 8;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = ((c + 0.5) / cols) * 2.5 - 1.25;
      const y = 1.3 - ((r + 0.5) / rows) * 2.45;
      if ((x * x + y * y - 1) ** 3 - x * x * y ** 3 <= 0) out.push({ c, r });
    }
  }
  return { out, cols, rows };
}

function layout(heart, urls) {
  const { out, cols, rows } = cells();
  heart.style.setProperty('--cols', String(cols));
  heart.style.setProperty('--rows', String(rows));
  out.forEach(({ c, r }, i) => {
    const tile = el('button', { class: 'fx-tile', attrs: { type: 'button', tabindex: '-1', 'aria-hidden': 'true' } });
    tile.style.gridColumn = String(c + 1);
    tile.style.gridRow = String(r + 1);
    // Bay vào từ một điểm ngẫu nhiên ngoài khung, lần lượt từng ô.
    const a = Math.random() * Math.PI * 2;
    tile.style.setProperty('--fx', `${Math.cos(a) * 120}vmax`);
    tile.style.setProperty('--fy', `${Math.sin(a) * 120}vmax`);
    tile.style.setProperty('--fr', `${(Math.random() - 0.5) * 720}deg`);
    tile.style.animationDelay = `${300 + i * 55}ms`;
    if (i % 3 === 0) tile.addEventListener('animationend', () => sfx.pop(0.1), { once: true });
    if (urls.length) {
      const src = urls[i % urls.length];
      tile.style.backgroundImage = `url("${src.replace(/"/g, '%22')}")`;
      tile.addEventListener('click', () => zoom(src));
    } else {
      tile.style.background = TINTS[i % TINTS.length];
      tile.textContent = EMOJI[i % EMOJI.length];
    }
    heart.append(tile);
  });
  // Ô cuối cùng hạ cánh thì trái tim bắt đầu đập.
  heart.style.setProperty('--beat-delay', `${300 + out.length * 55 + 900}ms`);
  setTimeout(() => heart.isConnected && (sfx.chime(), sfx.heartbeat(0.4)), 300 + out.length * 55 + 900);
}

function zoom(src) {
  const box = el('div', { class: 'fx-zoom', on: { click: () => box.remove() } }, [el('img', { attrs: { src, alt: '' } })]);
  document.body.append(box);
}

/** Nền: đốm sáng mờ và tim nhỏ trôi lên. */
function bokeh(view) {
  const { ctx } = view;
  const dots = Array.from({ length: 34 }, () => ({ x: Math.random(), y: Math.random(), r: 6 + Math.random() * 26, v: 0.00002 + Math.random() * 0.00005, c: Math.random() < 0.5 ? '255,92,147' : '255,209,102', a: 0.08 + Math.random() * 0.18 }));
  return {
    draw(t, dt) {
      ctx.clearRect(0, 0, view.w, view.h);
      for (const d of dots) {
        d.y -= d.v * dt;
        if (d.y < -0.1) d.y = 1.1;
        ctx.fillStyle = `rgba(${d.c},${d.a * (0.6 + 0.4 * Math.sin(t * 0.001 + d.r))})`;
        ctx.beginPath();
        ctx.arc(d.x * view.w + Math.sin(t * 0.0008 + d.r) * 14, d.y * view.h, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  };
}
