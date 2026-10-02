// Màn mở đầu đặc biệt (thay màn "Chạm để mở" của mẫu thiệp):
//   hop-qua  — hộp quà: chạm lắc 3 lần, nắp bung, tia sáng toả ra
//   sac-tim  — giữ tay lên trái tim cho tới khi "sạc" đầy 100%
//   ghep-anh — xếp đúng 9 mảnh ảnh mới được mở thiệp
import { confettiCannon } from '../core/confetti.js';
import { el, prefersReducedMotion, wait } from '../core/dom.js';
import { burstHearts } from '../core/hearts.js';
import { sfx } from '../core/sfx.js';
import { screen, swap } from '../templates/common.js';

/** Chạy màn mở đầu trong stage; xong (người nhận đã mở) thì Promise hoàn tất. onTouch: lần chạm đầu (bật nhạc). */
export async function runOpening(kind, stage, { name, imageUrls, onTouch }) {
  let touched = false;
  const touch = () => {
    if (touched) return;
    touched = true;
    onTouch?.();
  };
  if (kind === 'ghep-anh' && imageUrls.length) {
    const img = await squareImage(imageUrls[0]);
    if (img) return puzzle(stage, name, img, touch);
  }
  if (kind === 'sac-tim') return charge(stage, name, touch);
  return gift(stage, name, touch);
}

// ---------- Hộp quà ----------

function gift(stage, name, touch) {
  return new Promise((resolve) => {
    let taps = 0;
    const hint = el('p', { class: 'op-hint', text: 'Chạm vào hộp quà nhé 👆', attrs: { 'aria-live': 'polite' } });
    const box = el('button', { class: 'op-gift', attrs: { type: 'button', 'aria-label': 'Mở hộp quà' } }, [
      el('span', { class: 'op-rays' }),
      el('span', { class: 'op-base' }, [el('span', { class: 'op-ribbon-v' })]),
      el('span', { class: 'op-lid' }, [el('span', { class: 'op-ribbon-v' }), el('span', { class: 'op-bow' })]),
    ]);
    box.addEventListener('click', async () => {
      touch();
      taps++;
      navigator.vibrate?.(taps < 3 ? 25 : [30, 40, 60]);
      box.classList.remove('shake');
      void box.offsetWidth; // chạy lại hiệu ứng lắc
      if (taps < 3) {
        sfx.rattle(taps);
        box.classList.add('shake');
        box.style.setProperty('--power', String(taps));
        hint.textContent = taps === 1 ? 'Lắc thêm 2 lần nữa…' : 'Một lần nữa thôi!! 🤭';
        return;
      }
      box.disabled = true;
      box.classList.add('open');
      hint.textContent = 'Woaaa ✨';
      sfx.chime();
      flash();
      confettiCannon({ count: 120 });
      burstHearts({ count: 30 });
      await wait(prefersReducedMotion() ? 200 : 1500);
      resolve();
    });
    swap(stage, screen('op-screen', [el('p', { class: 'op-title', text: `Có một món quà cho ${name} 🎁` }), box, hint]));
  });
}

function flash() {
  if (prefersReducedMotion()) return;
  const f = el('div', { class: 'op-flash', attrs: { 'aria-hidden': 'true' } });
  document.body.append(f);
  setTimeout(() => f.remove(), 900);
}

// ---------- Sạc đầy yêu thương ----------

const SVG = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};
const HEART_PATH = 'M50 88 C20 66 4 48 4 30 C4 16 15 6 28 6 C37 6 45 11 50 19 C55 11 63 6 72 6 C85 6 96 16 96 30 C96 48 80 66 50 88 Z';

function charge(stage, name, touch) {
  return new Promise((resolve) => {
    const id = `op-clip-${Math.random().toString(36).slice(2, 8)}`;
    const wave = svg('path', { class: 'op-wave', d: wavePath(100, 0) });
    const art = svg('svg', { viewBox: '0 0 100 94', class: 'op-heart-svg', 'aria-hidden': 'true' });
    const clip = svg('clipPath', { id });
    clip.append(svg('path', { d: HEART_PATH }));
    const defs = svg('defs');
    defs.append(clip);
    const g = svg('g', { 'clip-path': `url(#${id})` });
    g.append(svg('rect', { x: '0', y: '0', width: '100', height: '94', class: 'op-heart-empty' }), wave);
    art.append(defs, g, svg('path', { d: HEART_PATH, class: 'op-heart-line' }));

    const pct = el('span', { class: 'op-pct', text: '0%' });
    const btn = el('button', { class: 'op-charge', attrs: { type: 'button', 'aria-label': 'Giữ để sạc yêu thương' } }, [art, pct]);
    const hint = el('p', { class: 'op-hint', text: 'Giữ tay lên trái tim nhé 👆', attrs: { 'aria-live': 'polite' } });
    const bar = el('div', { class: 'op-battery' }, [el('span')]);

    let level = 0;
    let holding = false;
    let raf = 0;
    let last = 0;
    let done = false;
    let tone = null; // âm cao dần khi giữ tay
    const MSG = [
      [0, 'Giữ tay lên trái tim nhé 👆'],
      [5, 'Đang sạc yêu thương… 💗'],
      [40, 'Ấm lên rồi nè ☺️'],
      [75, 'Sắp đầy rồiii!!'],
      [100, 'Đầy 100% rồi! 💥'],
    ];
    const tick = (now) => {
      const dt = last ? Math.min(50, now - last) : 16;
      last = now;
      const before = level;
      level = Math.max(0, Math.min(100, level + (holding ? dt / 24 : -dt / 60)));
      if (Math.floor(level / 10) > Math.floor(before / 10) && holding && navigator.userActivation?.hasBeenActive) navigator.vibrate?.(12);
      wave.setAttribute('d', wavePath(94 - (level / 100) * 98, now));
      pct.textContent = `${Math.round(level)}%`;
      bar.firstChild.style.width = `${level}%`;
      btn.style.setProperty('--level', String(level / 100));
      tone?.set(level / 100);
      hint.textContent = [...MSG].reverse().find(([v]) => level >= v)[1];
      if (level >= 100 && !done) return finish();
      raf = level > 0 || holding ? requestAnimationFrame(tick) : 0;
    };
    const start = (e) => {
      e.preventDefault();
      touch();
      if (e.pointerId !== undefined) btn.setPointerCapture?.(e.pointerId); // ngón tay hơi trượt ra vẫn tính là đang giữ
      holding = true;
      btn.classList.add('holding');
      tone ??= sfx.rise();
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(tick);
      }
    };
    const stop = () => {
      tone?.stop();
      tone = null;
      holding = false;
      btn.classList.remove('holding');
    };
    btn.addEventListener('pointerdown', start);
    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointercancel', stop);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
    btn.addEventListener('keydown', (e) => (e.key === ' ' || e.key === 'Enter') && !e.repeat && start(e));
    btn.addEventListener('keyup', stop);

    async function finish() {
      done = true;
      holding = false;
      tone?.stop();
      tone = null;
      sfx.chime();
      navigator.vibrate?.([40, 50, 80]);
      btn.classList.add('full');
      flash();
      burstHearts({ count: 60 });
      confettiCannon({ count: 100 });
      await wait(prefersReducedMotion() ? 200 : 1300);
      resolve();
    }

    swap(stage, screen('op-screen', [el('p', { class: 'op-title', text: `${name} ơi, giúp tớ một việc nhé` }), btn, bar, hint]));
  });
}

/** Mặt nước gợn sóng ở độ cao y (0 = đỉnh). */
function wavePath(y, t) {
  let d = `M0 ${y}`;
  for (let x = 0; x <= 100; x += 5) d += ` L${x} ${(y + Math.sin(x / 9 + t / 260) * 2.2).toFixed(2)}`;
  return `${d} L100 100 L0 100 Z`;
}

// ---------- Ghép ảnh ----------

/** Cắt ảnh thành hình vuông (giữa ảnh) để chia đều 3x3. */
function squareImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.naturalWidth, img.naturalHeight);
      const c = document.createElement('canvas');
      c.width = c.height = Math.min(600, s);
      c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, c.width, c.width);
      try {
        resolve(c.toDataURL('image/jpeg', 0.85));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function shuffled() {
  let order;
  do {
    order = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
  } while (order.filter((v, i) => v === i).length > 2);
  return order;
}

function puzzle(stage, name, dataUrl, touch) {
  return new Promise((resolve) => {
    const order = shuffled(); // order[ô] = mảnh đang nằm ở ô đó
    let picked = -1;
    let moves = 0;
    const board = el('div', { class: 'op-board' });
    board.style.setProperty('--peek', `url("${dataUrl}")`);
    const hint = el('p', { class: 'op-hint', text: 'Chạm 2 mảnh để đổi chỗ cho nhau', attrs: { 'aria-live': 'polite' } });
    const tiles = order.map((piece) => {
      const t = el('button', { class: 'op-piece', attrs: { type: 'button', 'aria-label': `Mảnh ${piece + 1}` } });
      t.style.backgroundImage = `url("${dataUrl}")`;
      t.style.backgroundPosition = `${(piece % 3) * 50}% ${Math.floor(piece / 3) * 50}%`;
      t.dataset.piece = String(piece);
      t.addEventListener('click', () => pick(t));
      board.append(t);
      return t;
    });
    const place = () =>
      tiles.forEach((t) => {
        const slot = order.indexOf(Number(t.dataset.piece));
        t.style.setProperty('--x', String(slot % 3));
        t.style.setProperty('--y', String(Math.floor(slot / 3)));
        t.classList.toggle('ok', slot === Number(t.dataset.piece));
      });
    place();

    const peek = el('button', {
      class: 'btn btn-soft btn-sm',
      text: '👀 Xem ảnh gốc',
      attrs: { type: 'button' },
      on: {
        click: () => {
          board.classList.add('peek');
          setTimeout(() => board.classList.remove('peek'), 1500);
        },
      },
    });
    const skip = el('button', { class: 'btn btn-ghost btn-sm op-skip', text: 'Khó quá, mở luôn 🙈', attrs: { type: 'button', hidden: '' }, on: { click: () => resolve() } });
    setTimeout(() => skip.removeAttribute('hidden'), 30000);

    function pick(t) {
      touch();
      const piece = Number(t.dataset.piece);
      if (picked < 0) {
        picked = piece;
        t.classList.add('picked');
        return;
      }
      const a = order.indexOf(picked);
      const b = order.indexOf(piece);
      tiles.forEach((x) => x.classList.remove('picked'));
      if (a !== b) {
        [order[a], order[b]] = [order[b], order[a]];
        moves++;
        sfx.click();
        navigator.vibrate?.(10);
        place();
        if (moves >= 14) skip.removeAttribute('hidden');
      }
      picked = -1;
      if (order.every((v, i) => v === i)) solved();
    }

    async function solved() {
      board.classList.add('solved');
      sfx.chime();
      hint.textContent = `Chuẩn luôn! ${moves} lượt 🎉`;
      tiles.forEach((t) => (t.disabled = true));
      confettiCannon({ count: 120 });
      await wait(prefersReducedMotion() ? 300 : 1800);
      resolve();
    }

    swap(
      stage,
      screen('op-screen', [
        el('p', { class: 'op-title', text: `${name} ơi, ghép lại bức ảnh này nhé 🧩` }),
        board,
        hint,
        el('div', { class: 'op-actions' }, [peek, skip]),
      ]),
    );
  });
}
