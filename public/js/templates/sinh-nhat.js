// Mẫu "Chúc mừng sinh nhật": bánh kem có nến thật. Chạm vào từng ngọn nến, hoặc bấm "Thổi vào micro"
// rồi thổi thật (micro chỉ dùng trên máy người xem, không ghi âm, không gửi đi đâu).
// Tắt hết nến → pháo hoa → nhắm mắt ước → lời chúc, ảnh, thư.
import { el, prefersReducedMotion, toast, wait } from '../core/dom.js';
import { confettiCannon } from '../core/confetti.js';
import { launchFireworks } from '../core/fireworks.js';
import { formatDuration } from '../core/receipt.js';
import { createSlideshow } from '../core/slideshow.js';
import { introScreen, letter, screen, swap } from './common.js';

/**
 * ctx: { data, imageUrls, onStart(), onYes(stats), onFinish() }
 * data.texts: age, title, wishPrompt, message
 */
export function render(stage, ctx) {
  swap(
    stage,
    introScreen({
      emoji: '🎂',
      name: ctx.data.recipientName,
      sub: 'hôm nay là một ngày thật đặc biệt…',
      onOpen: () => {
        ctx.onStart();
        showCake(stage, ctx);
      },
    }),
  );
}

const ageOf = (data) => (/^\d{1,3}$/.test(data.texts.age || '') ? Number(data.texts.age) : null);

function showCake(stage, ctx) {
  const age = ageOf(ctx.data);
  const count = age && age <= 9 ? age : 5;
  const shownAt = performance.now();
  let lit = count;
  let stopMic = null;

  const hint = el('p', { class: 'sn-hint', text: 'Chạm vào ngọn nến để thổi tắt nhé 🕯️', attrs: { 'aria-live': 'polite' } });
  const candles = Array.from({ length: count }, (_, i) => {
    const c = el('button', { class: 'sn-candle', attrs: { type: 'button', 'aria-label': `Nến ${i + 1}` } }, [el('span', { class: 'sn-flame' })]);
    c.style.setProperty('--i', String(i));
    c.addEventListener('click', () => blowOut(c));
    return c;
  });

  function blowOut(c) {
    if (c.classList.contains('out')) return;
    c.classList.add('out');
    navigator.vibrate?.(20);
    lit--;
    hint.textContent = lit ? `Còn ${lit} ngọn nữa…` : 'Yeahhh! 🎉';
    if (!lit) done();
  }

  async function done() {
    stopMic?.();
    ctx.onYes?.({ noPresses: 0, thinkMs: performance.now() - shownAt, extra: { candles: count, age } });
    const fw = launchFireworks({ bursts: 6 });
    confettiCannon({ count: 180 });
    await wait(prefersReducedMotion() ? 300 : 1600);
    showWish(stage, ctx, fw);
  }

  const mic = el('button', { class: 'btn btn-soft btn-sm', text: '🎤 Thổi thật vào micro', attrs: { type: 'button' } });
  mic.addEventListener('click', async () => {
    mic.disabled = true;
    try {
      stopMic = await listenForBlow(() => {
        const next = candles.find((c) => !c.classList.contains('out'));
        if (next) blowOut(next);
      });
      mic.textContent = '🌬️ Thổi mạnh vào micro nào!';
    } catch {
      mic.remove();
      toast('Trình duyệt này chưa cho dùng micro, bạn chạm vào nến nhé.', 3500);
    }
  });

  swap(
    stage,
    screen('sn-screen', [
      el('h1', { class: 'tt-big-question', text: 'Thổi nến đi nào! 🕯️' }),
      el('div', { class: 'sn-cake' }, [
        el('div', { class: 'sn-candles' }, candles),
        el('div', { class: 'sn-layer sn-top' }, [age ? el('span', { class: 'sn-age', text: String(age) }) : null]),
        el('div', { class: 'sn-layer sn-bottom' }),
        el('div', { class: 'sn-plate' }),
      ]),
      hint,
      navigator.mediaDevices?.getUserMedia ? mic : null,
    ]),
  );
}

/** Nghe micro, mỗi lần âm lượng vượt ngưỡng (đang thổi) thì gọi onBlow. Trả về hàm tắt micro. */
async function listenForBlow(onBlow) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const audio = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = audio.createAnalyser();
  analyser.fftSize = 512;
  audio.createMediaStreamSource(stream).connect(analyser);
  const buf = new Uint8Array(analyser.fftSize);
  let running = true;
  let loudSince = 0;
  let lastBlow = 0;
  const tick = (t) => {
    if (!running) return;
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += (v - 128) ** 2;
    const rms = Math.sqrt(sum / buf.length);
    if (rms > 22) {
      loudSince ||= t;
      if (t - loudSince > 180 && t - lastBlow > 260) {
        lastBlow = t;
        onBlow();
      }
    } else loudSince = 0;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return () => {
    running = false;
    stream.getTracks().forEach((tr) => tr.stop());
    audio.close().catch(() => {});
  };
}

function showWish(stage, ctx, fireworks) {
  const view = screen('sn-wish', [
    el('div', { class: 'sn-wish-icon', text: '🌠', attrs: { 'aria-hidden': 'true' } }),
    el('p', { class: 'sn-wish-text', text: ctx.data.texts.wishPrompt }),
    el('button', { class: 'btn btn-primary btn-lg', text: 'Mình ước xong rồi ✨', attrs: { type: 'button' }, on: { click: () => showStory(stage, ctx, fireworks) } }),
  ]);
  swap(stage, view);
}

async function showStory(stage, ctx, fireworks) {
  const { data, imageUrls } = ctx;
  const age = ageOf(data);
  const { node } = letter({ to: data.recipientName, message: data.texts.message, signature: data.senderName });
  const parts = [
    el('h2', { class: 'tt-after-yes reveal', text: data.texts.title }),
    age ? el('p', { class: 'sn-age-line reveal', text: `Chào mừng tuổi ${age} rực rỡ 🎈` }) : null,
    imageUrls.length ? el('div', { class: 'reveal' }, [createSlideshow(imageUrls)]) : null,
    el('div', { class: 'reveal' }, [node]),
  ].filter(Boolean);
  swap(stage, screen('tt-answer', parts));
  for (const p of parts) {
    await wait(prefersReducedMotion() ? 0 : 500);
    p.classList.add('shown');
  }
  await fireworks;
  ctx.onFinish();
}

/** Biên lai sinh nhật. */
export function receipt(data, r) {
  const age = ageOf(data);
  return {
    title: 'BIÊN LAI SINH NHẬT',
    rows: [
      ['Người chúc', data.senderName],
      ['Nhân vật chính', data.recipientName],
      ...(age ? [['Tuổi mới', age]] : []),
      ['Số nến đã thổi', r?.extra?.candles ?? '—'],
      ['Thời gian thổi nến', formatDuration(r?.thinkMs ?? 0)],
      ['Điều ước', 'Bí mật 🤫'],
    ],
    verdict: 'Điều ước đã được ghi nhận. Tuổi mới chỉ toàn chuyện vui thôi nha 🎉',
    stamp: 'ĐÃ ƯỚC',
  };
}
