// Mẫu "Cả nhóm gửi lời chúc": cả lớp/cả phòng cùng ký tên. Người nhận thấy "bức tường" giấy nhớ
// bay vào từng tờ, mỗi tờ là lời chúc của một người, rồi tới lời chúc chung, ảnh và hoa rơi.
import { el, prefersReducedMotion, wait } from '../core/dom.js';
import { confettiCannon } from '../core/confetti.js';
import { startPetals } from '../core/petals.js';
import { createSlideshow } from '../core/slideshow.js';
import { introScreen, letter, screen, swap } from './common.js';

const NOTE_COLORS = ['#fff3b0', '#ffd6e0', '#d7f2e6', '#dbeafe', '#ffe4c4', '#f1e4ff'];

/**
 * ctx: { data, imageUrls, signatures: [{ name, message, sticker }], onStart(), onFinish() }
 * data.texts: groupName, title, message
 */
export function render(stage, ctx) {
  const n = ctx.signatures.length;
  swap(
    stage,
    introScreen({
      emoji: '💐',
      name: ctx.data.recipientName,
      sub: n ? `có ${n} lời chúc đang chờ bạn mở nè…` : 'có một món quà từ cả nhóm…',
      onOpen: () => {
        ctx.onStart();
        showWall(stage, ctx);
      },
    }),
  );
}

async function showWall(stage, ctx) {
  const { data, imageUrls, signatures } = ctx;
  const stopPetals = startPetals();
  confettiCannon({ count: 120 });
  const notes = signatures.map((s, i) =>
    el('figure', { class: 'cn-note' }, [
      el('span', { class: 'cn-sticker', text: s.sticker, attrs: { 'aria-hidden': 'true' } }),
      el('blockquote', { class: 'cn-msg', text: s.message }),
      el('figcaption', { class: 'cn-name', text: `— ${s.name}` }),
    ]),
  );
  notes.forEach((note, i) => {
    note.style.setProperty('--tilt', `${((i * 37) % 9) - 4}deg`);
    note.style.background = NOTE_COLORS[i % NOTE_COLORS.length];
  });
  const { node } = letter({ to: data.recipientName, message: data.texts.message, signature: data.texts.groupName || data.senderName });
  const parts = [
    el('h2', { class: 'tt-after-yes reveal', text: data.texts.title }),
    el('p', { class: 'cn-from reveal', text: `Từ: ${data.texts.groupName || data.senderName}` }),
    signatures.length
      ? el('div', { class: 'reveal' }, [
          el('p', { class: 'cn-count' }, [el('strong', { text: String(signatures.length) }), el('span', { text: ' người đã ký tên gửi lời chúc 💐' })]),
        ])
      : null,
    notes.length ? el('div', { class: 'cn-wall' }, notes) : null,
    el('div', { class: 'reveal' }, [node]),
    imageUrls.length ? el('div', { class: 'reveal' }, [createSlideshow(imageUrls)]) : null,
  ].filter(Boolean);
  swap(stage, screen('tt-answer cn-screen', parts));

  const step = prefersReducedMotion() ? 0 : 420;
  for (const p of parts) {
    if (p.classList.contains('cn-wall')) {
      // Từng tờ giấy nhớ bay vào; nhiều người ký thì bay nhanh hơn.
      const each = prefersReducedMotion() ? 0 : Math.max(120, 900 - notes.length * 25);
      for (const note of notes) {
        note.classList.add('shown');
        await wait(each);
      }
      continue;
    }
    await wait(step);
    p.classList.add('shown');
  }
  setTimeout(stopPetals, 8000);
  ctx.onFinish();
}

