// Mảnh ghép dùng chung cho các mẫu thiệp.
import { el } from '../core/dom.js';
import { sfx } from '../core/sfx.js';

/** Một "màn" của thiệp, chiếm trọn màn hình. */
export const screen = (cls, children) => el('section', { class: `tt-screen ${cls}` }, children);

/** Thay màn hiện tại bằng màn mới. */
export function swap(stage, next) {
  stage.querySelector('.tt-screen')?.remove();
  stage.append(next);
}

let skipIntro = false;
/** Đã có màn mở đầu đặc biệt (hộp quà, sạc tim…) → màn "Chạm để mở" kế tiếp tự mở luôn. */
export const skipNextIntro = () => (skipIntro = true);

/** Màn mở đầu "Chạm để mở" — cú chạm này cũng là lúc được phép bật nhạc. */
export function introScreen({ emoji, name, sub, button = 'Chạm để mở', onOpen }) {
  if (skipIntro) {
    skipIntro = false;
    queueMicrotask(onOpen); // chạy sau khi mẫu thiệp gắn màn này vào, nên thay thế ngay trước khi kịp hiện
  }
  return screen('tt-intro', [
    el('div', { class: 'tt-envelope', text: emoji, attrs: { 'aria-hidden': 'true' } }),
    el('p', { class: 'tt-intro-name', text: `${name} ơi,` }),
    el('p', { class: 'tt-intro-sub', text: sub }),
    el('button', { class: 'btn btn-primary btn-lg tt-open', text: button, attrs: { type: 'button' }, on: { click: () => (sfx.chime(0.16), onOpen()) } }),
  ]);
}

/** Lá thư: "Gửi ...", lời nhắn, chữ ký. Trả về cả phần tử lời nhắn để có thể gõ chữ dần. */
export function letter({ to, message, signature }) {
  const body = el('p', { class: 'tt-message', text: message });
  const sign = el('p', { class: 'tt-signature', text: `— ${signature}` });
  const node = el('div', { class: 'tt-letter' }, [el('p', { class: 'tt-letter-to', text: `Gửi ${to},` }), body, sign]);
  return { node, body, sign };
}
