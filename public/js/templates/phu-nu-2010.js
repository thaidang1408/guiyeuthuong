// Mẫu "Gửi người phụ nữ đặc biệt" (20/10):
// phong bì → chạm mở → hoa rơi → ảnh trình chiếu → lời chúc hiện từng chữ → chữ ký.
import { el, prefersReducedMotion, wait } from '../core/dom.js';
import { startPetals } from '../core/petals.js';
import { createSlideshow } from '../core/slideshow.js';
import { typeText } from '../core/typewriter.js';
import { letter, screen, swap } from './common.js';

/**
 * ctx: { data, imageUrls, onStart(), onFinish() }
 * data.texts: envelope, title, message
 */
export function render(stage, ctx) {
  showEnvelope(stage, ctx);
}

function showEnvelope(stage, ctx) {
  const { texts } = ctx.data;
  const envelope = el('button', { class: 'pn-envelope', attrs: { type: 'button', 'aria-label': 'Mở thư' } }, [
    el('span', { class: 'pn-letter-peek', attrs: { 'aria-hidden': 'true' } }),
    el('span', { class: 'pn-pocket', attrs: { 'aria-hidden': 'true' } }),
    el('span', { class: 'pn-flap', attrs: { 'aria-hidden': 'true' } }),
    el('span', { class: 'pn-seal', text: '🌷', attrs: { 'aria-hidden': 'true' } }),
    el('span', { class: 'pn-to', text: texts.envelope }),
  ]);
  const hint = el('p', { class: 'pn-hint', text: 'Chạm vào phong bì để mở thư' });

  let opened = false;
  envelope.addEventListener('click', async () => {
    if (opened) return;
    opened = true;
    ctx.onStart();
    envelope.classList.add('open');
    hint.textContent = '';
    await wait(prefersReducedMotion() ? 0 : 1100);
    startPetals();
    showLetter(stage, ctx);
  });

  swap(stage, screen('pn-cover', [envelope, hint]));
}

async function showLetter(stage, ctx) {
  const { data, imageUrls } = ctx;
  const { node, body, sign } = letter({ to: data.recipientName, message: '', signature: data.senderName });
  sign.classList.add('pn-hidden');

  const parts = [
    el('h1', { class: 'pn-title reveal', text: data.texts.title }),
    imageUrls.length ? el('div', { class: 'reveal' }, [createSlideshow(imageUrls, { interval: 3200 })]) : null,
    el('div', { class: 'reveal' }, [node]),
  ].filter(Boolean);
  swap(stage, screen('pn-content', parts));

  const step = prefersReducedMotion() ? 0 : 700;
  for (const p of parts) {
    await wait(step);
    p.classList.add('shown');
  }
  // Có ảnh thì để người xem ngắm một nhịp trước khi lời chúc bắt đầu hiện.
  if (imageUrls.length) await wait(prefersReducedMotion() ? 0 : 1200);
  await typeText(body, data.texts.message);
  sign.classList.remove('pn-hidden');
  await wait(prefersReducedMotion() ? 0 : 600);
  ctx.onFinish();
}
