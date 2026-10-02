// Hiện chữ từng ký tự như đang gõ. Chạm vào đoạn chữ để hiện hết ngay.
// Luôn gán bằng textContent (an toàn với chữ người dùng nhập).
import { prefersReducedMotion } from './dom.js';

export function typeText(el, text, { speed = 42 } = {}) {
  const chars = Array.from(text); // tách theo ký tự thật (emoji không bị vỡ đôi)
  if (prefersReducedMotion() || !chars.length) {
    el.textContent = text;
    return Promise.resolve();
  }
  el.classList.add('typing');
  return new Promise((resolve) => {
    let i = 0;
    let timer = 0;
    const finish = () => {
      clearTimeout(timer);
      el.textContent = text;
      el.classList.remove('typing');
      el.removeEventListener('click', finish);
      resolve();
    };
    const step = () => {
      i++;
      el.textContent = chars.slice(0, i).join('');
      if (i >= chars.length) return finish();
      // Dừng lâu hơn một chút sau dấu câu cho tự nhiên.
      const pause = /[.,!?…\n]/.test(chars[i - 1]) ? speed * 6 : speed;
      timer = setTimeout(step, pause);
    };
    el.addEventListener('click', finish);
    timer = setTimeout(step, speed);
  });
}
