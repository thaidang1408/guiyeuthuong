// Mẫu "Làm người yêu tớ nhé?" — nút "Không" bỏ chạy, nút "Có" to dần, bấm "Có" thì pháo hoa.
import { el, prefersReducedMotion, wait } from '../core/dom.js';
import { confettiCannon } from '../core/confetti.js';
import { launchFireworks } from '../core/fireworks.js';
import { sfx } from '../core/sfx.js';
import { formatDuration } from '../core/receipt.js';
import { scratchCard } from '../core/scratch.js';
import { createSlideshow } from '../core/slideshow.js';
import { introScreen, letter, screen, swap } from './common.js';

const TAUNTS = [
  'Ơ kìa, bấm trượt rồi 😝',
  'Nút đó hỏng rồi á~',
  'Thử lại xem nào 😆',
  'Không bắt được đâu 😜',
  'Bấm nút bên kia đi mà 🥺',
  'Chạy đâu cho thoát 🙈',
  'Nút "Có" to thế kia cơ mà!',
];
const YES_GROWTH = 0.14;
const YES_MAX_SCALE = 2.4;
const EDGE = 12; // khoảng cách tối thiểu tới mép màn hình (px)

/**
 * ctx: { data, imageUrls, onStart(), onYes(stats), onFinish() }
 * data.texts: question, yesText, noText, afterYes, secret, message
 */
export function render(stage, ctx) {
  const { data } = ctx;
  stage.append(floatingHearts());
  showIntro(stage, ctx, () => showQuestion(stage, ctx, () => showAnswer(stage, ctx)));
  return { recipient: data.recipientName };
}

function floatingHearts() {
  const wrap = el('div', { class: 'tt-hearts', attrs: { 'aria-hidden': 'true' } });
  if (prefersReducedMotion()) return wrap;
  for (let i = 0; i < 12; i++) {
    const h = el('span', { text: i % 3 ? '♥' : '♡' });
    h.style.left = `${(i * 83) % 100}%`;
    h.style.animationDelay = `${(i * 1.7) % 9}s`;
    h.style.animationDuration = `${9 + (i % 4) * 2}s`;
    h.style.fontSize = `${14 + (i % 4) * 6}px`;
    wrap.append(h);
  }
  return wrap;
}

function showIntro(stage, ctx, next) {
  swap(
    stage,
    introScreen({
      emoji: '💌',
      name: ctx.data.recipientName,
      sub: `có người muốn hỏi ${ctx.data.pr.ban} một câu…`,
      onOpen: () => {
        ctx.onStart();
        next();
      },
    }),
  );
}

function showQuestion(stage, ctx, onYes) {
  const { texts } = ctx.data;
  let dodges = 0;
  let yesScale = 1;
  const shownAt = performance.now();

  const hint = el('p', { class: 'tt-hint', text: '', attrs: { 'aria-live': 'polite' } });
  const yes = el('button', {
    class: 'btn tt-yes',
    text: texts.yesText,
    attrs: { type: 'button' },
    on: {
      click: () => {
        ctx.onYes?.({ noPresses: dodges, thinkMs: performance.now() - shownAt });
        onYes();
      },
    },
  });
  const no = el('button', { class: 'btn tt-no', text: texts.noText, attrs: { type: 'button' } });

  const dodge = (e) => {
    e?.preventDefault();
    dodges++;
    yesScale = Math.min(YES_MAX_SCALE, yesScale + YES_GROWTH);
    yes.style.transform = `scale(${yesScale})`;
    hint.textContent = TAUNTS[(dodges - 1) % TAUNTS.length];
    sfx.boing();
    moveAway(no, yes);
  };
  // Chuột rê tới là chạy; ngón tay chạm vào là chạy trước khi kịp "bấm".
  let lastPointerDown = 0;
  no.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && dodge(e));
  no.addEventListener('pointerdown', (e) => {
    lastPointerDown = performance.now();
    dodge(e);
  });
  // Bàn phím (Enter/Space) cũng không bấm được. "click" ngay sau một lần chạm thì bỏ qua để không né hai lần.
  no.addEventListener('click', (e) => {
    e.preventDefault();
    if (performance.now() - lastPointerDown > 800) dodge(e);
  });

  const q = screen('tt-question', [
    el('h1', { class: 'tt-big-question', text: texts.question }),
    el('div', { class: 'tt-buttons' }, [yes, no]),
    hint,
  ]);
  swap(stage, q);

  // Giữ nút "Không" trong màn hình khi xoay ngang/dọc.
  window.addEventListener('resize', () => no.classList.contains('runaway') && moveAway(no, yes));
}

/** Đưa nút "Không" tới chỗ ngẫu nhiên trong màn hình, tránh đè lên nút "Có". */
function moveAway(no, yes) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!no.classList.contains('runaway')) {
    const r = no.getBoundingClientRect();
    no.style.left = `${r.left}px`;
    no.style.top = `${r.top}px`;
    no.classList.add('runaway');
  }
  const nw = no.offsetWidth;
  const nh = no.offsetHeight;
  const y = yes.getBoundingClientRect();
  const current = no.getBoundingClientRect();

  let best = null;
  for (let i = 0; i < 20; i++) {
    const left = EDGE + Math.random() * Math.max(0, vw - nw - EDGE * 2);
    const top = EDGE + Math.random() * Math.max(0, vh - nh - EDGE * 2);
    const overlapsYes = left < y.right + 8 && left + nw > y.left - 8 && top < y.bottom + 8 && top + nh > y.top - 8;
    const farEnough = Math.hypot(left - current.left, top - current.top) > Math.min(vw, vh) * 0.25;
    best = { left, top };
    if (!overlapsYes && farEnough) break;
  }
  no.style.left = `${best.left}px`;
  no.style.top = `${best.top}px`;
}

async function showAnswer(stage, ctx) {
  const { data, imageUrls } = ctx;
  const fireworks = launchFireworks();
  confettiCannon();

  const { node } = letter({ to: data.recipientName, message: data.texts.message, signature: data.senderName });
  const answer = screen('tt-answer', [
    el('h2', { class: 'tt-after-yes reveal', text: data.texts.afterYes }),
    data.texts.secret ? el('div', { class: 'reveal' }, [scratchCard({ text: data.texts.secret })]) : null,
    imageUrls.length ? el('div', { class: 'reveal' }, [createSlideshow(imageUrls)]) : null,
    el('div', { class: 'reveal' }, [node]),
  ]);
  swap(stage, answer);

  // Hiện lần lượt từng phần cho có nhịp.
  const parts = answer.querySelectorAll('.reveal');
  for (const p of parts) {
    await wait(prefersReducedMotion() ? 0 : 450);
    p.classList.add('shown');
  }
  await fireworks;
  ctx.onFinish();
}

/** Biên lai tỏ tình (hiện ở cuối thiệp để người nhận lưu/chia sẻ). */
export function receipt(data, r) {
  const n = r?.noPresses ?? 0;
  const verdict =
    n === 0 ? 'Đồng ý ngay không cần nghĩ. Thích người ta từ lâu rồi đúng không 😳'
    : n <= 3 ? 'Làm giá nhẹ cho có, chứ trong lòng đồng ý từ đầu rồi 😌'
    : n <= 9 ? 'Cứng đầu nhưng dễ thương, cuối cùng vẫn gật đầu 😤💕'
    : 'Chạy cả một vòng marathon mới chịu đồng ý. Đáng mặt người khó cưa 🏃‍♀️💨';
  return {
    title: 'BIÊN LAI TỎ TÌNH',
    rows: [
      ['Người hỏi', data.senderName],
      ['Người trả lời', data.recipientName],
      ['Số lần né nút "Không"', n],
      ['Thời gian suy nghĩ', formatDuration(r?.thinkMs ?? 0)],
      ['Kết quả', 'ĐỒNG Ý ✓'],
    ],
    verdict,
    stamp: 'ĐÃ CHỐT',
  };
}
