// "Mở cùng nhau" (cho cặp đôi yêu xa): thiệp chỉ mở khi cả hai cùng bấm "Mình sẵn sàng".
// Hai máy hỏi server mỗi 2 giây; khi cả hai cùng chờ, server chốt MỘT mốc giờ chung để hai bên
// cùng đếm ngược 3-2-1 và cùng mở (lệch nhau không quá vài trăm mili-giây).
import { togetherPing } from '../core/api.js';
import { el, wait } from '../core/dom.js';
import { sfx } from '../core/sfx.js';
import { TOGETHER } from '../shared/extras.js';
import { screen, swap } from '../templates/common.js';

/** Sau bấy lâu chờ thì cho phép mở một mình (lỡ người kia bận). */
const ALONE_AFTER_MS = 3 * 60 * 1000;

/**
 * opts: { slug, side: 'gui' | 'nhan', editToken?, me, other, preview, onTouch }
 * me/other: tên hiển thị của mình và người kia. Trả Promise xong khi tới lúc mở thiệp.
 */
export function togetherGate(stage, opts) {
  return new Promise((resolve) => {
    const status = el('p', { class: 'tg-status', attrs: { 'aria-live': 'polite' }, text: `${opts.other} chưa vào…` });
    const heartMe = el('div', { class: 'tg-heart tg-me' }, [el('span', { text: '💗' }), el('small', { text: opts.me })]);
    const heartOther = el('div', { class: 'tg-heart tg-other' }, [el('span', { text: '💗' }), el('small', { text: opts.other })]);
    const count = el('div', { class: 'tg-count', attrs: { 'aria-hidden': 'true' } });
    const ready = el('button', { class: 'btn btn-primary btn-lg', text: '💞 Mình sẵn sàng rồi', attrs: { type: 'button' } });
    const alone = el('button', { class: 'btn btn-ghost btn-sm', text: 'Không đợi nữa, mở một mình', attrs: { type: 'button', hidden: '' } });
    const view = screen('tg-screen', [
      el('p', { class: 'tt-intro-name', text: `${opts.me} ơi,` }),
      el('p', { class: 'tt-intro-sub', text: `Tấm thiệp này phải mở CÙNG NHAU. Hai bạn gọi video cho nhau rồi cùng bấm nút nhé 📞` }),
      el('div', { class: 'tg-hearts' }, [heartMe, count, heartOther]),
      status,
      ready,
      alone,
    ]);
    swap(stage, view);

    let offset = 0; // giờ server - giờ máy
    let polling = false;
    let finished = false;
    let startedAt = Date.now();

    const finish = () => {
      if (finished) return;
      finished = true;
      resolve();
    };
    alone.addEventListener('click', finish);

    async function countdownTo(startAt) {
      polling = false;
      view.classList.add('both');
      status.textContent = `${opts.other} cũng sẵn sàng rồi! Cùng mở nè…`;
      ready.hidden = true;
      alone.hidden = true;
      sfx.chime(0.18);
      for (;;) {
        const left = startAt - (Date.now() + offset);
        if (left <= 0) break;
        const n = Math.ceil(left / 1000);
        if (count.textContent !== String(n)) {
          count.textContent = String(n);
          count.classList.remove('tick');
          void count.offsetWidth;
          count.classList.add('tick');
          sfx.pop(0.2);
        }
        await wait(Math.min(100, left));
      }
      view.classList.add('merge');
      count.textContent = '';
      sfx.heartbeat(0.5);
      if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.([30, 40, 60]);
      await wait(900);
      finish();
    }

    async function poll() {
      while (polling && !finished) {
        if (Date.now() - startedAt > ALONE_AFTER_MS) alone.hidden = false;
        if (Date.now() - startedAt > TOGETHER.maxWaitMs) {
          polling = false;
          ready.hidden = false;
          ready.disabled = false;
          ready.textContent = '🔁 Thử chờ lại';
          status.textContent = `Chưa thấy ${opts.other}. Hai bạn hẹn lại rồi bấm thử lại nhé.`;
          return;
        }
        try {
          const r = opts.preview ? fakePing() : await togetherPing(opts.slug, opts.side, opts.editToken);
          offset = r.serverNow - Date.now();
          heartOther.classList.toggle('on', r.otherReady);
          status.textContent = r.otherReady ? `✅ ${opts.other} đã sẵn sàng!` : `⏳ Đang chờ ${opts.other} bấm sẵn sàng…`;
          if (r.startAt) return countdownTo(r.startAt);
        } catch (e) {
          status.textContent = e.message;
        }
        await wait(TOGETHER.pollMs);
      }
    }

    // Bản xem thử: giả như người kia vào sau 2 giây.
    let fakeStart = 0;
    function fakePing() {
      const now = Date.now();
      const otherReady = now - readyAt > 2000;
      if (otherReady && !fakeStart) fakeStart = now + TOGETHER.countdownMs;
      return { otherReady, startAt: fakeStart || null, serverNow: now };
    }

    let readyAt = 0;
    ready.addEventListener('click', () => {
      opts.onTouch?.();
      sfx.pop();
      readyAt = Date.now();
      ready.disabled = true;
      ready.textContent = '💗 Đã sẵn sàng';
      heartMe.classList.add('on');
      status.textContent = `⏳ Đang chờ ${opts.other}…`;
      if (!polling) {
        polling = true;
        startedAt = Date.now();
        poll();
      }
    });
  });
}
