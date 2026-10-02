// Mẫu Thư "Mở khi…": một xấp phong bì, mỗi lá cho một lúc (buồn, nhớ, cãi nhau…).
// Lá nào hẹn ngày thì server giấu nội dung tới đúng ngày; trên thiệp hiện ổ khóa và số ngày còn lại.
import { el, prefersReducedMotion } from '../core/dom.js';
import { typeText } from '../core/typewriter.js';
import { introScreen, screen, swap } from './common.js';

const COUNT = 6;
const DAY = 24 * 60 * 60 * 1000;

/**
 * ctx: { data, slug?, onStart(), onFinish() }
 * data.texts: intro, l1Title, l1Body, l1Date … l6Title, l6Body, l6Date
 */
export function render(stage, ctx) {
  swap(
    stage,
    introScreen({
      emoji: '✉️',
      name: ctx.data.recipientName,
      sub: 'có một xấp thư dành riêng cho bạn…',
      onOpen: () => {
        ctx.onStart();
        showLetters(stage, ctx);
      },
    }),
  );
}

function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

const openedKey = 'mo-khi:' + location.pathname;
function loadOpened() {
  try {
    return new Set(JSON.parse(localStorage.getItem(openedKey) || '[]'));
  } catch {
    return new Set();
  }
}
function saveOpened(set) {
  try {
    localStorage.setItem(openedKey, JSON.stringify([...set]));
  } catch {
    /* không sao */
  }
}

function showLetters(stage, ctx) {
  const { texts } = ctx.data;
  const opened = loadOpened();
  const letters = [];
  for (let i = 1; i <= COUNT; i++) {
    const title = texts[`l${i}Title`];
    const body = texts[`l${i}Body`];
    const date = parseDate(texts[`l${i}Date`]);
    if (!title || (!body && !date)) continue;
    letters.push({ i, title, body, date, locked: !body || (date && date.getTime() > Date.now()) });
  }

  const grid = el('div', { class: 'mk-grid' });
  for (const l of letters) {
    const days = l.date ? Math.ceil((l.date.getTime() - Date.now()) / DAY) : 0;
    const env = el('button', { class: 'mk-envelope' + (l.locked ? ' locked' : '') + (opened.has(l.i) ? ' opened' : ''), attrs: { type: 'button' } }, [
      el('span', { class: 'mk-icon', text: l.locked ? '🔒' : opened.has(l.i) ? '📭' : '💌', attrs: { 'aria-hidden': 'true' } }),
      el('span', { class: 'mk-title', text: l.title }),
      el('span', {
        class: 'mk-sub',
        text: l.locked
          ? `Mở vào ${String(l.date.getDate()).padStart(2, '0')}/${String(l.date.getMonth() + 1).padStart(2, '0')}${days > 0 ? ` · còn ${days} ngày` : ''}`
          : opened.has(l.i) ? 'Đã mở' : 'Chạm để mở',
      }),
    ]);
    env.addEventListener('click', () => {
      if (l.locked) {
        env.classList.remove('shake');
        void env.offsetWidth;
        env.classList.add('shake');
        return;
      }
      opened.add(l.i);
      saveOpened(opened);
      env.classList.add('opened');
      env.querySelector('.mk-icon').textContent = '📭';
      env.querySelector('.mk-sub').textContent = 'Đã mở';
      openLetter(l, ctx.data.senderName);
    });
    grid.append(env);
  }

  swap(
    stage,
    screen('tt-answer mk-screen', [
      el('h2', { class: 'tt-after-yes', text: `Gửi ${ctx.data.recipientName} 💌` }),
      el('p', { class: 'mk-intro', text: texts.intro }),
      grid,
      el('p', { class: 'muted small', text: 'Mỗi lá dành cho một lúc. Lá có ổ khóa thì phải đợi đúng ngày mới mở được nhé.' }),
    ]),
  );
  ctx.onFinish();
}

function openLetter(l, sender) {
  const body = el('p', { class: 'tt-message' });
  const close = () => overlay.remove();
  const overlay = el('div', { class: 'mk-overlay', on: { click: (e) => e.target === overlay && close() } }, [
    el('article', { class: 'tt-letter mk-letter', attrs: { role: 'dialog', 'aria-label': l.title } }, [
      el('p', { class: 'tt-letter-to', text: l.title }),
      body,
      el('p', { class: 'tt-signature', text: `— ${sender}` }),
      el('button', { class: 'btn btn-ghost btn-sm', text: 'Gấp thư lại', attrs: { type: 'button' }, on: { click: close } }),
    ]),
  ]);
  document.body.append(overlay);
  if (prefersReducedMotion()) body.textContent = l.body;
  else typeText(body, l.body);
}
