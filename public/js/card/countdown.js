// Màn đếm ngược của thiệp hẹn giờ mở: "Còn 02 ngày 05:12:33 nữa…". Tới giờ thì gọi onDone
// (trang thiệp thật tải lại để server gửi nội dung; bản xem thử thì mở luôn).
import { el } from '../core/dom.js';
import { applyFont } from '../core/fonts.js';
import { loadCss } from '../templates/registry.js';
import { formatOpenAt } from '../shared/schedule.js';

/**
 * opts: { template, name, sender, openAt, waitUntil, serverNow?, font?, preview?, onDone }
 * serverNow: giờ của server lúc tải trang — dùng để đếm đúng cả khi đồng hồ điện thoại bị lệch.
 */
export async function showCountdown(root, opts) {
  const offset = opts.serverNow ? opts.serverNow - Date.now() : 0;
  const now = () => Date.now() + offset;
  root.className = `card-root theme-${opts.template}`;
  await Promise.all([loadCss(opts.template), applyFont(opts.font)]);

  const unit = (label) => {
    const num = el('strong', { text: '00' });
    return { num, node: el('div', { class: 'cd-unit' }, [num, el('span', { text: label })]) };
  };
  const units = [unit('ngày'), unit('giờ'), unit('phút'), unit('giây')];
  const skip = opts.preview
    ? el('button', { class: 'btn btn-soft btn-sm', text: '⏩ Bỏ qua (chỉ có ở bản xem thử)', attrs: { type: 'button' }, on: { click: () => finish() } })
    : null;

  root.replaceChildren(
    el('main', { class: 'card-stage' }, [
      el('section', { class: 'tt-screen tt-intro cd-screen' }, [
        el('div', { class: 'tt-envelope cd-lock', text: '⏰', attrs: { 'aria-hidden': 'true' } }),
        el('p', { class: 'tt-intro-name', text: `${opts.name} ơi,` }),
        el('p', { class: 'tt-intro-sub', text: `${opts.sender} đã gửi bạn một tấm thiệp, nhưng phải đợi tới giờ mới được mở 💌` }),
        el('div', { class: 'cd-units', attrs: { role: 'timer', 'aria-live': 'off' } }, units.map((u) => u.node)),
        el('p', { class: 'cd-at', text: `Mở lúc ${formatOpenAt(opts.openAt)}` }),
        el('p', { class: 'muted small', text: 'Cứ để nguyên trang này, tới giờ thiệp tự mở nha ✨' }),
        skip,
      ]),
    ]),
  );

  let timer = 0;
  let done = false;
  function finish() {
    if (done) return;
    done = true;
    clearInterval(timer);
    opts.onDone();
  }
  const tick = () => {
    const left = Math.max(0, opts.waitUntil - now());
    const s = Math.floor(left / 1000);
    const parts = [Math.floor(s / 86400), Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60];
    parts.forEach((v, i) => (units[i].num.textContent = String(v).padStart(2, '0')));
    if (left <= 0) setTimeout(finish, 600);
  };
  tick();
  timer = setInterval(tick, 1000);
  // Quay lại tab sau một lúc lâu: tính lại ngay.
  document.addEventListener('visibilitychange', () => !document.hidden && !done && tick());
}
