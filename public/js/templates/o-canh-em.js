// Mẫu "Muốn ở cạnh nhau": giữ tay lên màn hình để hai trái tim nhích lại gần nhau (rung nhẹ theo nhịp tim),
// buông tay là chúng trôi xa ra. Chạm nhau → hòa làm một, tim bung khắp màn hình →
// đếm ngày yêu đang chạy, "những lúc anh nhớ em", ảnh, lá thư, đếm ngược tới lần gặp tới.
import { el, prefersReducedMotion, wait } from '../core/dom.js';
import { launchFireworks } from '../core/fireworks.js';
import { burstHearts } from '../core/hearts.js';
import { formatDuration } from '../core/receipt.js';
import { createSlideshow } from '../core/slideshow.js';
import { introScreen, letter, screen, swap } from './common.js';

const HOLD_MS = 2600; // giữ bao lâu thì hai tim chạm nhau
const DRIFT_MS = 1400; // buông tay: trôi từ sát nhau về chỗ cũ mất bao lâu
const DAY = 24 * 60 * 60 * 1000;

/**
 * ctx: { data, imageUrls, onStart(), onFinish() }
 * data.texts: loveStart, holdHint, afterHug, reasonsTitle, reasons, message, nextMeet, meetText
 */
export function render(stage, ctx) {
  swap(
    stage,
    introScreen({
      emoji: '🫂',
      name: ctx.data.recipientName,
      sub: `${ctx.data.pr.toi} có điều này muốn nói với ${ctx.data.pr.ban}…`,
      onOpen: () => {
        ctx.onStart();
        showHug(stage, ctx);
      },
    }),
  );
}

// ---------- Màn "ôm": giữ để hai tim lại gần ----------

function showHug(stage, ctx) {
  const hint = el('p', { class: 'oc-hint', text: ctx.data.texts.holdHint, attrs: { 'aria-live': 'polite' } });
  const left = el('span', { class: 'oc-heart oc-left', text: '💗', attrs: { 'aria-hidden': 'true' } });
  const right = el('span', { class: 'oc-heart oc-right', text: '💗', attrs: { 'aria-hidden': 'true' } });
  const glow = el('span', { class: 'oc-glow', attrs: { 'aria-hidden': 'true' } });
  const track = el('div', { class: 'oc-track' }, [glow, left, right]);
  const pad = el('div', {
    class: 'oc-pad',
    attrs: { role: 'button', tabindex: '0', 'aria-label': 'Giữ để ôm' },
  }, [track, el('span', { class: 'oc-pad-label', text: 'Giữ ở đây' })]);
  const view = screen('oc-hug', [hint, pad]);
  swap(stage, view);

  const holdMs = prefersReducedMotion() ? 900 : HOLD_MS;
  let p = 0; // 0 = xa nhau, 1 = chạm nhau
  let holding = false;
  let done = false;
  let last = 0;
  let lastBeat = 0;
  let everHeld = false;
  let releases = 0; // số lần buông tay giữa chừng
  const shownAt = performance.now();

  const setHint = () => {
    if (holding) hint.textContent = p > 0.7 ? 'Sắp chạm rồi… 💓' : p > 0.3 ? 'Gần thêm chút nữa…' : 'Giữ chặt nha…';
    else if (everHeld && p > 0) hint.textContent = 'Đừng buông mà 🥺';
  };

  const frame = (t) => {
    const dt = last ? t - last : 16;
    last = t;
    p = holding ? Math.min(1, p + dt / holdMs) : Math.max(0, p - dt / DRIFT_MS);
    view.style.setProperty('--p', p.toFixed(3));
    // Nhịp tim nhanh dần khi lại gần (máy Android rung nhẹ theo, iPhone thì bỏ qua).
    const beatEvery = 900 - p * 450;
    if (holding && t - lastBeat > beatEvery) {
      lastBeat = t;
      navigator.vibrate?.([18, 90, 12]);
      track.classList.remove('beat');
      void track.offsetWidth;
      track.classList.add('beat');
    }
    setHint();
    if (p >= 1) return finish();
    if (holding || p > 0) requestAnimationFrame(frame);
    else last = 0;
  };

  const start = (e) => {
    if (done) return;
    e?.preventDefault();
    if (!holding) {
      holding = true;
      everHeld = true;
      pad.classList.add('holding');
      if (!last) requestAnimationFrame(frame);
    }
  };
  const stop = () => {
    if (!holding) return;
    holding = false;
    releases++;
    pad.classList.remove('holding');
  };

  pad.addEventListener('pointerdown', (e) => {
    pad.setPointerCapture?.(e.pointerId);
    start(e);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) pad.addEventListener(type, stop);
  pad.addEventListener('contextmenu', (e) => e.preventDefault()); // giữ lâu không bật menu
  pad.addEventListener('keydown', (e) => (e.key === ' ' || e.key === 'Enter') && start(e));
  pad.addEventListener('keyup', stop);

  async function finish() {
    done = true;
    holding = false;
    view.classList.add('met');
    ctx.onYes?.({ noPresses: releases, thinkMs: performance.now() - shownAt });
    navigator.vibrate?.([40, 60, 40, 60, 120]);
    hint.textContent = ctx.data.texts.afterHug;
    const hearts = burstHearts({ count: 60 });
    launchFireworks({ bursts: 3, duration: 2400 });
    await wait(prefersReducedMotion() ? 600 : 2200);
    await hearts;
    showStory(stage, ctx);
  }
}

// ---------- Đếm ngày, danh sách, ảnh, thư, đếm ngược ----------

/** "YYYY-MM-DD" → nửa đêm theo giờ máy người xem; sai định dạng → null. */
function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() : null;
}

const fmt = (n) => n.toLocaleString('vi-VN');

/** Gọi cập nhật mỗi giây, tự dừng khi phần tử bị gỡ khỏi trang. */
function everySecond(node, update) {
  update();
  const timer = setInterval(() => (node.isConnected ? update() : clearInterval(timer)), 1000);
}

function togetherBlock(startMs) {
  const days = el('p', { class: 'oc-days' });
  const detail = el('p', { class: 'oc-detail' });
  const node = el('div', { class: 'oc-counter' }, [el('p', { class: 'oc-label', text: 'Mình đã bên nhau' }), days, detail]);
  everySecond(node, () => {
    const ms = Date.now() - startMs;
    const d = Math.floor(ms / DAY);
    const h = Math.floor((ms % DAY) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    days.textContent = `${fmt(d)} ngày`;
    detail.textContent = `${h} giờ ${m} phút ${String(s).padStart(2, '0')} giây · tức là ${fmt(Math.floor(ms / 3600000))} giờ thương nhau`;
  });
  return node;
}

function meetBlock(meetMs, meetText) {
  const text = el('p', { class: 'oc-meet-text' });
  const node = el('div', { class: 'oc-meet' }, [el('span', { class: 'oc-meet-icon', text: '⏳', attrs: { 'aria-hidden': 'true' } }), text]);
  everySecond(node, () => {
    const left = meetMs - Date.now();
    if (left <= 0) {
      text.textContent = left > -DAY ? 'Hôm nay mình gặp nhau rồi! 🥰' : '';
      node.hidden = left <= -DAY;
      return;
    }
    const d = Math.floor(left / DAY);
    const h = Math.floor((left % DAY) / 3600000);
    const m = Math.floor((left % 3600000) / 60000);
    const s = Math.floor((left % 60000) / 1000);
    text.textContent = `Còn ${d ? `${d} ngày ` : ''}${h} giờ ${m} phút ${String(s).padStart(2, '0')} giây ${meetText}`;
  });
  return node;
}

async function showStory(stage, ctx) {
  const { data, imageUrls } = ctx;
  const { texts } = data;
  const startMs = parseDate(texts.loveStart);
  const meetMs = parseDate(texts.nextMeet);
  const reasons = (texts.reasons || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const { node } = letter({ to: data.recipientName, message: texts.message, signature: data.senderName });

  const reasonItems = reasons.map((r) => el('li', { class: 'oc-reason' }, [el('span', { text: '💗', attrs: { 'aria-hidden': 'true' } }), el('span', { text: r })]));
  const parts = [
    el('h2', { class: 'tt-after-yes reveal', text: texts.afterHug }),
    startMs !== null && startMs <= Date.now() ? el('div', { class: 'reveal' }, [togetherBlock(startMs)]) : null,
    reasons.length
      ? el('div', { class: 'reveal oc-reasons' }, [el('h3', { class: 'oc-reasons-title', text: texts.reasonsTitle }), el('ul', {}, reasonItems)])
      : null,
    imageUrls.length ? el('div', { class: 'reveal' }, [createSlideshow(imageUrls)]) : null,
    el('div', { class: 'reveal' }, [node]),
    meetMs !== null && meetMs > Date.now() - DAY ? el('div', { class: 'reveal' }, [meetBlock(meetMs, texts.meetText)]) : null,
  ].filter(Boolean);
  swap(stage, screen('tt-answer oc-story', parts));

  const step = prefersReducedMotion() ? 0 : 600;
  for (const p of parts) {
    await wait(step);
    p.classList.add('shown');
    // Danh sách hiện từng dòng một.
    if (p.classList.contains('oc-reasons')) {
      for (const li of reasonItems) {
        await wait(step);
        li.classList.add('shown');
      }
    }
  }
  ctx.onFinish();
}

/** Biên lai cái ôm. */
export function receipt(data, r) {
  const start = parseDate(data.texts.loveStart);
  const n = r?.noPresses ?? 0;
  return {
    title: 'BIÊN LAI CÁI ÔM',
    rows: [
      ['Người ôm', data.senderName],
      ['Người được ôm', data.recipientName],
      ...(start !== null && start <= Date.now() ? [['Đã bên nhau', `${fmt(Math.floor((Date.now() - start) / DAY))} ngày`]] : []),
      ['Số lần lỡ buông tay', n],
      ['Thời gian để chạm nhau', formatDuration(r?.thinkMs ?? 0)],
      ['Độ ấm áp', '100% 🔥'],
    ],
    verdict: n === 0 ? 'Giữ chặt không buông một giây nào. Nhớ nhau lắm rồi đúng không 🥺' : 'Buông ra mấy lần nhưng vẫn quay lại. Không xa nhau được đâu 💞',
    stamp: 'ĐÃ ÔM',
  };
}
