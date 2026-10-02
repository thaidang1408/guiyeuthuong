// Mẫu "Tha lỗi cho tớ nhé": nút "Không tha" nhỏ dần qua mỗi lần bấm, chữ đổi theo, rồi biến mất.
// Bấm "Tha" → trái tim bay → lời nhắn.
import { el, prefersReducedMotion, wait } from '../core/dom.js';
import { confettiCannon } from '../core/confetti.js';
import { burstHearts } from '../core/hearts.js';
import { sfx } from '../core/sfx.js';
import { formatDuration } from '../core/receipt.js';
import { scratchCard } from '../core/scratch.js';
import { createSlideshow } from '../core/slideshow.js';
import { introScreen, letter, screen, swap } from './common.js';

const SHRINK = 0.16; // mỗi lần bấm "Không tha" nhỏ đi chừng này
const YES_GROWTH = 0.1;

/**
 * ctx: { data, imageUrls, onStart(), onFinish() }
 * data.texts: question, yesText, noText, pleas (mỗi dòng một câu), afterYes, coupon, message
 */
export function render(stage, ctx) {
  swap(
    stage,
    introScreen({
      emoji: '🥺',
      name: ctx.data.recipientName,
      sub: `${ctx.data.pr.toi} có chuyện muốn nói với ${ctx.data.pr.ban}…`,
      onOpen: () => {
        ctx.onStart();
        showQuestion(stage, ctx);
      },
    }),
  );
}

function showQuestion(stage, ctx) {
  const { texts } = ctx.data;
  const pleas = texts.pleas.split('\n').map((s) => s.trim()).filter(Boolean);
  // Số lần bấm trước khi nút biến mất: đủ để hiện hết các câu năn nỉ (tối thiểu 3, tối đa 6).
  const maxPresses = Math.min(6, Math.max(3, pleas.length));
  let presses = 0;
  const shownAt = performance.now();

  const hint = el('p', { class: 'tt-hint', attrs: { 'aria-live': 'polite' } });
  const yes = el('button', {
    class: 'btn xl-yes',
    text: texts.yesText,
    attrs: { type: 'button' },
    on: {
      click: () => {
        ctx.onYes?.({ noPresses: presses, thinkMs: performance.now() - shownAt });
        showAnswer(stage, ctx);
      },
    },
  });
  const no = el('button', { class: 'btn xl-no', text: texts.noText, attrs: { type: 'button' } });

  no.addEventListener('click', () => {
    presses++;
    sfx.sad();
    yes.style.transform = `scale(${1 + presses * YES_GROWTH})`;
    if (presses >= maxPresses) {
      no.classList.add('gone');
      hint.textContent = 'Giờ chỉ còn một lựa chọn thôi nè 😌';
      setTimeout(() => no.remove(), prefersReducedMotion() ? 0 : 400);
      return;
    }
    no.style.transform = `scale(${Math.max(0.3, 1 - presses * SHRINK)})`;
    no.textContent = pleas.length ? pleas[(presses - 1) % pleas.length] : texts.noText;
  });

  swap(
    stage,
    screen('tt-question', [
      el('h1', { class: 'tt-big-question', text: texts.question }),
      el('div', { class: 'xl-buttons' }, [yes, no]),
      hint,
    ]),
  );
}

async function showAnswer(stage, ctx) {
  const { data, imageUrls } = ctx;
  const hearts = burstHearts();
  confettiCannon({ count: 90 });
  const { node } = letter({ to: data.recipientName, message: data.texts.message, signature: data.senderName });
  const parts = [
    el('h2', { class: 'tt-after-yes reveal', text: data.texts.afterYes }),
    data.texts.coupon ? el('div', { class: 'reveal' }, [scratchCard({ text: data.texts.coupon, label: 'Cào để nhận quà chuộc lỗi 🎁' })]) : null,
    imageUrls.length ? el('div', { class: 'reveal' }, [createSlideshow(imageUrls)]) : null,
    el('div', { class: 'reveal' }, [node]),
  ].filter(Boolean);
  swap(stage, screen('tt-answer', parts));

  for (const p of parts) {
    await wait(prefersReducedMotion() ? 0 : 500);
    p.classList.add('shown');
  }
  await hearts;
  ctx.onFinish();
}

/** Biên lai tha thứ. */
export function receipt(data, r) {
  const n = r?.noPresses ?? 0;
  const verdict =
    n === 0 ? 'Tha ngay lập tức. Thương quá nên giận không nổi 🥹'
    : n <= 2 ? 'Giận một chút cho có lệ, rồi cũng mềm lòng 😌'
    : 'Bắt năn nỉ đủ kiểu mới chịu tha. Lần sau liệu hồn nha 😤';
  return {
    title: 'BIÊN LAI THA THỨ',
    rows: [
      ['Người có lỗi', data.senderName],
      ['Người rộng lượng', data.recipientName],
      ['Số lần bấm "Không tha"', n],
      ['Thời gian giận dỗi', formatDuration(r?.thinkMs ?? 0)],
      ['Kết quả', 'ĐÃ THA ✓'],
    ],
    verdict,
    stamp: 'HẾT GIẬN',
  };
}
