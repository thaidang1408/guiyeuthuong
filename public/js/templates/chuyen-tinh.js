// Mẫu "Chuyện tình của tụi mình" (cho hai người đang yêu): kể lại chuyện tình theo kiểu story Instagram/TikTok —
// đếm số ngày bên nhau → từng khoảnh khắc kèm ảnh (chạm phải để tới, chạm trái để lùi, tự chạy sau vài giây)
// → lời hứa: người nhận giữ tay để "móc ngoéo" → pháo hoa → lá thư.
import { el, prefersReducedMotion, wait } from '../core/dom.js';
import { launchFireworks } from '../core/fireworks.js';
import { burstHearts } from '../core/hearts.js';
import { sfx } from '../core/sfx.js';
import { demoPhotos } from '../card/player.js';
import { introScreen, letter, screen, swap } from './common.js';

const SLIDE_MS = 5500; // mỗi khoảnh khắc tự chuyển sau bấy nhiêu
const PROMISE_MS = 1600; // giữ tay bao lâu thì "móc ngoéo" xong
const DAY = 24 * 60 * 60 * 1000;
const MAX_MOMENTS = 6;

/**
 * ctx: { data, imageUrls, preview, onStart(), onYes(), onFinish() }
 * data.texts: loveStart, storyTitle, moments (mỗi dòng một khoảnh khắc), promise, message
 */
export function render(stage, ctx) {
  const { pr } = ctx.data;
  swap(
    stage,
    introScreen({
      emoji: '💞',
      name: ctx.data.recipientName,
      sub: `${pr.Toi} kể ${pr.ban} nghe chuyện của tụi mình nhé`,
      button: 'Xem chuyện tình mình ▶',
      onOpen: () => {
        ctx.onStart();
        showStory(stage, ctx);
      },
    }),
  );
}

/** Số ngày từ ngày bắt đầu yêu tới hôm nay (null nếu chưa điền hoặc ngày ở tương lai). */
function daysTogether(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const now = new Date();
  const days = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(y, m - 1, d)) / DAY);
  return days >= 0 ? days : null;
}

function showStory(stage, ctx) {
  const t = ctx.data.texts;
  const photos = ctx.imageUrls.length || !ctx.preview ? ctx.imageUrls : demoPhotos();
  const moments = (t.moments || '').split('\n').map((s) => s.trim()).filter(Boolean).slice(0, MAX_MOMENTS);
  const days = daysTogether(t.loveStart);

  // Danh sách "trang" của story.
  const slides = [];
  slides.push({ kind: 'title' });
  if (days !== null) slides.push({ kind: 'days' });
  moments.forEach((text, i) => slides.push({ kind: 'moment', text, photo: photos.length ? photos[i % photos.length] : null, i }));
  // Ảnh còn dư (nhiều ảnh hơn khoảnh khắc): thêm trang chỉ có ảnh.
  for (let i = moments.length; i < photos.length && slides.length < 12; i++) slides.push({ kind: 'moment', text: '', photo: photos[i], i });
  slides.push({ kind: 'promise' });

  const bars = el('div', { class: 'cs-bars', attrs: { 'aria-hidden': 'true' } }, slides.map(() => el('i', {}, [el('b')])));
  const body = el('div', { class: 'cs-body' });
  const story = el('div', { class: 'cs-story' }, [bars, body]);
  swap(stage, screen('cs-screen', [story]));

  let idx = -1;
  let timer = 0;
  let finished = false;

  const go = (n) => {
    if (finished) return;
    n = Math.max(0, Math.min(slides.length - 1, n));
    if (n === idx) return;
    clearTimeout(timer);
    idx = n;
    [...bars.children].forEach((bar, i) => {
      bar.className = i < idx ? 'done' : i === idx ? 'active' : '';
    });
    const s = slides[idx];
    body.replaceChildren(slideView(s, ctx, days, () => (finished = true)));
    if (idx > 0) sfx.pop(0.12);
    if (s.kind !== 'promise') timer = setTimeout(() => go(idx + 1), prefersReducedMotion() ? SLIDE_MS * 1.5 : SLIDE_MS);
    bars.style.setProperty('--slide-ms', `${SLIDE_MS}ms`);
  };

  // Chạm nửa trái: lùi; nửa phải: tới (trừ khi đang chạm vào nút ở trang lời hứa).
  story.addEventListener('click', (e) => {
    if (e.target.closest('button') || slides[idx]?.kind === 'promise') return;
    const r = story.getBoundingClientRect();
    go(e.clientX - r.left < r.width * 0.3 ? idx - 1 : idx + 1);
  });

  go(0);

  function slideView(s, ctx, days, markDone) {
    const { data } = ctx;
    if (s.kind === 'title') {
      return el('div', { class: 'cs-slide cs-title' }, [
        el('p', { class: 'cs-kicker', text: `${data.senderName} ❤ ${data.recipientName}` }),
        el('h1', { class: 'cs-big', text: data.texts.storyTitle }),
        el('p', { class: 'cs-tap', text: 'Chạm để xem tiếp ›' }),
      ]);
    }
    if (s.kind === 'days') {
      const num = el('span', { class: 'cs-days-num', text: '0' });
      countUp(num, days);
      const [y, m, d] = data.texts.loveStart.split('-');
      return el('div', { class: 'cs-slide cs-days' }, [
        el('p', { class: 'cs-kicker', text: 'Mình đã bên nhau' }),
        num,
        el('p', { class: 'cs-days-unit', text: 'ngày' }),
        el('p', { class: 'cs-days-from', text: `kể từ ${d}/${m}/${y} 💕` }),
      ]);
    }
    if (s.kind === 'moment') {
      const photo = s.photo
        ? el('div', { class: 'cs-photo' }, [el('div', { class: 'cs-photo-bg' }), el('img', { attrs: { src: s.photo, alt: '' } })])
        : el('div', { class: 'cs-photo cs-photo-empty', text: ['💑', '🌸', '☕', '🎡', '🌅', '💌'][s.i % 6] });
      if (s.photo) photo.firstChild.style.backgroundImage = `url("${s.photo.replace(/"/g, '%22')}")`;
      return el('div', { class: 'cs-slide cs-moment' }, [photo, s.text ? el('p', { class: 'cs-caption', text: s.text }) : null]);
    }
    return promiseView(ctx, markDone);
  }

  /** Trang cuối: giữ tay để móc ngoéo. */
  function promiseView(ctx, markDone) {
    const hint = el('p', { class: 'cs-hint', text: 'Giữ tay vào đây để móc ngoéo nha 🤙', attrs: { 'aria-live': 'polite' } });
    const btn = el('button', { class: 'cs-pinky', attrs: { type: 'button', 'aria-label': 'Giữ để móc ngoéo' } }, [
      el('span', { class: 'cs-pinky-ring' }),
      el('span', { class: 'cs-pinky-hand', text: '🤙' }),
    ]);
    let p = 0;
    let holding = false;
    let last = 0;
    let done = false;
    let tone = null;
    const frame = (now) => {
      const dt = last ? Math.min(50, now - last) : 16;
      last = now;
      p = holding ? Math.min(1, p + dt / PROMISE_MS) : Math.max(0, p - dt / 700);
      btn.style.setProperty('--p', p.toFixed(3));
      tone?.set(p);
      if (p >= 1 && !done) return finish();
      if (holding || p > 0) requestAnimationFrame(frame);
      else last = 0;
    };
    const start = (e) => {
      e.preventDefault();
      if (done) return;
      if (e.pointerId !== undefined) btn.setPointerCapture?.(e.pointerId);
      holding = true;
      btn.classList.add('holding');
      hint.textContent = 'Giữ chặt nha…';
      tone ??= sfx.rise();
      if (!last) requestAnimationFrame(frame);
    };
    const stop = () => {
      holding = false;
      btn.classList.remove('holding');
      tone?.stop();
      tone = null;
      if (!done && p > 0) hint.textContent = 'Đừng buông mà 🥺';
    };
    btn.addEventListener('pointerdown', start);
    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointercancel', stop);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
    btn.addEventListener('keydown', (e) => (e.key === ' ' || e.key === 'Enter') && !e.repeat && start(e));
    btn.addEventListener('keyup', stop);

    async function finish() {
      done = true;
      markDone();
      tone?.stop();
      tone = null;
      btn.classList.add('sealed');
      hint.textContent = 'Hứa rồi đó nha, không được nuốt lời 💞';
      navigator.vibrate?.([30, 40, 70]);
      sfx.chime();
      ctx.onYes();
      burstHearts({ count: 60 });
      launchFireworks({ bursts: 5 });
      await wait(prefersReducedMotion() ? 400 : 2600);
      showLetter(stage, ctx);
    }

    return el('div', { class: 'cs-slide cs-promise' }, [
      el('p', { class: 'cs-kicker', text: 'Và một lời hứa…' }),
      el('h2', { class: 'cs-promise-text', text: ctx.data.texts.promise }),
      btn,
      hint,
    ]);
  }
}

function countUp(node, target) {
  if (prefersReducedMotion() || target < 2) {
    node.textContent = target.toLocaleString('vi-VN');
    return;
  }
  const t0 = performance.now();
  const dur = 1600;
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    node.textContent = Math.round(target * (1 - (1 - k) ** 3)).toLocaleString('vi-VN');
    if (k < 1 && node.isConnected) requestAnimationFrame(step);
    else if (k >= 1) sfx.sparkle(6);
  };
  requestAnimationFrame(step);
}

function showLetter(stage, ctx) {
  const { data } = ctx;
  const { node } = letter({ to: data.recipientName, message: data.texts.message, signature: data.senderName });
  const again = el('button', {
    class: 'btn btn-soft',
    text: '↻ Xem lại chuyện tình mình',
    attrs: { type: 'button' },
    on: { click: () => showStory(stage, ctx) },
  });
  swap(stage, screen('cs-end', [node, again]));
  // Xem lại rồi tới cuối lần nữa thì không gắn thêm phần cuối thiệp.
  if (!ctx.ended) {
    ctx.ended = true;
    ctx.onFinish();
  }
}
