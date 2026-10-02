// Mẫu "Đi chơi với tớ không?": nút "Không" nhảy chỗ rồi tự đổi thành "Đi"; người nhận chọn ngày, chọn món,
// nhắn thêm → câu trả lời gửi về cho người tạo → "vé hẹn" hiện ra với con dấu "ĐÃ CHỐT KÈO" + pháo hoa.
import { el, prefersReducedMotion, toast, wait } from '../core/dom.js';
import { confettiCannon } from '../core/confetti.js';
import { launchFireworks } from '../core/fireworks.js';
import { formatDuration } from '../core/receipt.js';
import { createSlideshow } from '../core/slideshow.js';
import { introScreen, letter, screen, swap } from './common.js';

const NO_TEXTS = ['Bận thật hả? 🥺', 'Tớ bao mà 😚', 'Suy nghĩ lại đi…'];
const DAYS_SHOWN = 7;
const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/**
 * ctx: { data, imageUrls, onStart(), onFinish(), onAnswer(answer) → Promise }
 * data.texts: question, yesText, noText, dateQuestion, foodQuestion, foods (mỗi dòng một món), afterAnswer, message
 */
export function render(stage, ctx) {
  swap(
    stage,
    introScreen({
      emoji: '🎟️',
      name: ctx.data.recipientName,
      sub: `có một lời mời dành riêng cho ${ctx.data.pr.ban} nè…`,
      onOpen: () => {
        ctx.onStart();
        showQuestion(stage, ctx);
      },
    }),
  );
}

function showQuestion(stage, ctx) {
  const { texts } = ctx.data;
  let presses = 0;
  const shownAt = performance.now();
  const goNext = () => showDate(stage, ctx, { noPresses: presses, thinkMs: performance.now() - shownAt });
  const yes = el('button', { class: 'btn dc-yes', text: texts.yesText, attrs: { type: 'button' }, on: { click: goNext } });
  const no = el('button', { class: 'btn dc-no', text: texts.noText, attrs: { type: 'button' } });
  const buttons = el('div', { class: 'dc-buttons' }, [yes, no]);
  no.addEventListener('click', () => {
    if (no.classList.contains('dc-converted')) return goNext();
    presses++;
    if (presses > NO_TEXTS.length) {
      // Hết đường từ chối: nút "Không" biến thành nút "Đi".
      no.classList.add('dc-converted');
      no.textContent = 'Thôi được, đi! 😆';
      return;
    }
    no.textContent = NO_TEXTS[presses - 1];
    no.style.animation = 'none';
    void no.offsetWidth; // chạy lại hiệu ứng lắc
    no.style.animation = '';
    // Nhảy sang phía bên kia nút "Đi".
    buttons.classList.toggle('dc-swapped');
    yes.style.transform = `scale(${1 + presses * 0.08})`;
  });

  swap(stage, screen('tt-question', [el('h1', { class: 'tt-big-question', text: texts.question }), buttons]));
}

/** Ngày dạng YYYY-MM-DD theo giờ máy người xem. */
const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function dateLabel(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAY[date.getDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

/** Nhóm nút chọn một: trả về phần tử và hàm đánh dấu. */
function choiceGroup(items, onPick) {
  const group = el('div', { class: 'dc-chips', attrs: { role: 'radiogroup' } });
  const select = (btn) => {
    for (const c of group.children) {
      c.classList.toggle('selected', c === btn);
      c.setAttribute('aria-checked', String(c === btn));
    }
  };
  for (const { label, value } of items) {
    const btn = el('button', { class: 'dc-chip', text: label, attrs: { type: 'button', role: 'radio', 'aria-checked': 'false' } });
    btn.addEventListener('click', () => {
      select(btn);
      onPick(value, btn);
    });
    group.append(btn);
  }
  return { group, select };
}

function showDate(stage, ctx, answer) {
  const next = el('button', { class: 'btn btn-primary btn-lg dc-next', text: 'Tiếp tục →', attrs: { type: 'button', disabled: '' } });
  const pick = (date) => {
    answer.date = date;
    next.disabled = !date;
  };

  const today = new Date();
  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const iso = isoDate(d);
    return { label: i === 0 ? 'Hôm nay' : i === 1 ? 'Ngày mai' : dateLabel(iso), value: iso };
  });
  const other = el('input', { class: 'input dc-date-input', attrs: { type: 'date', min: isoDate(today), hidden: '', 'aria-label': 'Chọn ngày khác' } });
  other.addEventListener('change', () => pick(other.value));
  const { group } = choiceGroup([...days, { label: '📅 Ngày khác', value: null }], (value) => {
    other.hidden = value !== null;
    if (value === null) {
      pick(other.value || null);
      other.showPicker?.();
    } else pick(value);
  });
  next.addEventListener('click', () => answer.date && showFood(stage, ctx, answer));

  swap(stage, screen('dc-step', [el('h2', { class: 'dc-step-title', text: ctx.data.texts.dateQuestion }), group, other, next]));
}

function showFood(stage, ctx, answer) {
  const { texts, senderName } = ctx.data;
  const foods = texts.foods.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 12);
  const send = el('button', { class: 'btn btn-primary btn-lg dc-next', text: 'Gửi câu trả lời 💌', attrs: { type: 'button', disabled: '' } });
  const custom = el('input', { class: 'input', attrs: { maxlength: '40', placeholder: 'Cậu muốn ăn gì nè?', hidden: '', 'aria-label': 'Món khác' } });
  const pick = (food) => {
    answer.food = (food || '').trim();
    send.disabled = !answer.food;
  };
  custom.addEventListener('input', () => pick(custom.value));
  const { group } = choiceGroup([...foods.map((f) => ({ label: f, value: f })), { label: '✍️ Món khác', value: null }], (value) => {
    custom.hidden = value !== null;
    if (value === null) {
      pick(custom.value);
      custom.focus();
    } else pick(value);
  });
  const note = el('textarea', { class: 'input dc-note', attrs: { rows: '2', maxlength: '200', placeholder: `Nhắn thêm cho ${senderName}… (không bắt buộc)` } });

  send.addEventListener('click', async () => {
    send.disabled = true;
    send.classList.add('loading');
    try {
      await ctx.onAnswer({ date: answer.date, food: answer.food, note: note.value.trim() });
      ctx.onYes?.({ noPresses: answer.noPresses, thinkMs: answer.thinkMs, extra: { date: answer.date, food: answer.food } });
      showTicket(stage, ctx, answer);
    } catch (e) {
      toast(e.message, 4000);
      send.disabled = false;
      send.classList.remove('loading');
    }
  });

  swap(
    stage,
    screen('dc-step', [
      el('button', { class: 'dc-back', text: '← Đổi ngày', attrs: { type: 'button' }, on: { click: () => showDate(stage, ctx, answer) } }),
      el('h2', { class: 'dc-step-title', text: texts.foodQuestion }),
      group,
      custom,
      note,
      send,
    ]),
  );
}

async function showTicket(stage, ctx, answer) {
  const { data, imageUrls } = ctx;
  const fireworks = launchFireworks({ bursts: 5 });
  confettiCannon();
  const [y, m, d] = answer.date.split('-').map(Number);
  const longDate = new Date(y, m - 1, d).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  const ticket = el('div', { class: 'dc-ticket' }, [
    el('div', { class: 'dc-ticket-main' }, [
      el('p', { class: 'dc-ticket-label', text: 'VÉ HẸN ĐI CHƠI' }),
      el('p', { class: 'dc-ticket-names', text: `${data.senderName} ♥ ${data.recipientName}` }),
      el('p', { class: 'dc-ticket-row', text: `📅 ${longDate.charAt(0).toUpperCase()}${longDate.slice(1)}` }),
      // Món trong danh sách thường đã có biểu tượng riêng (🍲 Lẩu); món tự gõ thì thêm 🍽️.
      el('p', { class: 'dc-ticket-row', text: /^\p{Extended_Pictographic}/u.test(answer.food) ? answer.food : `🍽️ ${answer.food}` }),
    ]),
    el('div', { class: 'dc-stamp', text: 'ĐÃ CHỐT KÈO', attrs: { 'aria-hidden': 'true' } }),
  ]);
  const { node } = letter({ to: data.recipientName, message: data.texts.message, signature: data.senderName });
  const parts = [
    el('h2', { class: 'tt-after-yes reveal', text: data.texts.afterAnswer }),
    el('div', { class: 'reveal' }, [ticket]),
    el('p', { class: 'muted small reveal center', text: `Câu trả lời đã được gửi tới ${data.senderName} ✓` }),
    imageUrls.length ? el('div', { class: 'reveal' }, [createSlideshow(imageUrls)]) : null,
    el('div', { class: 'reveal' }, [node]),
  ].filter(Boolean);
  swap(stage, screen('tt-answer', parts));

  for (const p of parts) {
    await wait(prefersReducedMotion() ? 0 : 450);
    p.classList.add('shown');
    if (p.contains(ticket)) ticket.classList.add('stamped');
  }
  await fireworks;
  ctx.onFinish();
}

/** Biên lai hẹn hò. */
export function receipt(data, r) {
  const n = r?.noPresses ?? 0;
  const [y, m, d] = (r?.extra?.date || '').split('-');
  return {
    title: 'BIÊN LAI CHỐT KÈO',
    rows: [
      ['Người rủ', data.senderName],
      ['Người được rủ', data.recipientName],
      ['Ngày hẹn', d ? `${d}/${m}/${y}` : '—'],
      ['Món chốt', r?.extra?.food || '—'],
      ['Số lần kêu "bận"', n],
      ['Thời gian suy nghĩ', formatDuration(r?.thinkMs ?? 0)],
    ],
    verdict: n === 0 ? 'Rủ phát đi luôn, đúng là chỉ chờ được rủ 😆' : 'Làm giá vài câu nhưng vẫn đi. Ai bùng là thua nha 😤',
    stamp: 'ĐÃ CHỐT KÈO',
  };
}
