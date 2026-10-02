// Màn khóa: trả lời câu hỏi bí mật → giữ tay để phá dấu niêm phong sáp → thiệp mở.
import { el, prefersReducedMotion, wait } from '../core/dom.js';
import { hashAnswer } from '../shared/lock.js';

const SEAL_HOLD_MS = 1300;

/** Chờ người nhận mở khóa xong. lock: { question, hint, answerHash } */
export function unlockCard(stage, lock, { recipientName }) {
  return new Promise((resolve) => {
    const input = el('input', { class: 'input lock-input', attrs: { placeholder: 'Câu trả lời của bạn', autocomplete: 'off', maxlength: '40' } });
    const msg = el('p', { class: 'lock-msg', attrs: { 'aria-live': 'polite' } });
    const submit = el('button', { class: 'btn btn-primary btn-lg', text: 'Mở khóa 🔓', attrs: { type: 'submit' } });
    const form = el('form', { class: 'lock-form' }, [input, submit, msg]);
    const view = el('section', { class: 'tt-screen lock-screen' }, [
      el('div', { class: 'lock-icon', text: '🔐', attrs: { 'aria-hidden': 'true' } }),
      el('p', { class: 'tt-intro-name', text: `${recipientName} ơi,` }),
      el('p', { class: 'lock-lead', text: 'Thiệp này chỉ dành cho đúng một người. Trả lời câu hỏi này để mở nhé:' }),
      el('h1', { class: 'lock-question', text: lock.question }),
      form,
    ]);
    stage.append(view);

    let wrong = 0;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!input.value.trim()) return input.focus();
      if ((await hashAnswer(input.value)) === lock.answerHash) {
        view.remove();
        showSeal(stage).then(resolve);
        return;
      }
      wrong++;
      view.classList.remove('shake');
      void view.offsetWidth;
      view.classList.add('shake');
      navigator.vibrate?.(80);
      msg.textContent = wrong >= 3 && lock.hint ? `Chưa đúng rồi. Gợi ý: ${lock.hint}` : 'Chưa đúng rồi, thử lại nha 🤔';
      if (wrong >= 6 && !form.querySelector('.lock-giveup')) {
        form.append(
          el('button', {
            class: 'btn btn-ghost btn-sm lock-giveup',
            text: 'Chịu thua, cho mình vào đi 😅',
            attrs: { type: 'button' },
            on: { click: () => (view.remove(), showSeal(stage).then(resolve)) },
          }),
        );
      }
      input.select();
    });
  });
}

/** Dấu sáp: giữ tay đủ lâu thì nứt vỡ. */
function showSeal(stage) {
  return new Promise((resolve) => {
    const seal = el('button', { class: 'wax-seal', attrs: { type: 'button', 'aria-label': 'Giữ để phá dấu niêm phong' } }, [el('span', { text: '💗' })]);
    const hint = el('p', { class: 'lock-lead', text: 'Đúng rồi! Giờ giữ tay lên dấu niêm phong để mở thư…' });
    const view = el('section', { class: 'tt-screen lock-screen' }, [hint, seal]);
    stage.append(view);
    const holdMs = prefersReducedMotion() ? 300 : SEAL_HOLD_MS;
    let timer = null;
    const start = (e) => {
      e.preventDefault();
      seal.classList.add('pressing');
      seal.style.setProperty('--hold', `${holdMs}ms`);
      navigator.vibrate?.([15, 60, 15, 60, 15]);
      timer = setTimeout(async () => {
        seal.classList.add('broken');
        navigator.vibrate?.(60);
        await wait(prefersReducedMotion() ? 0 : 700);
        view.remove();
        resolve();
      }, holdMs);
    };
    const stop = () => {
      if (seal.classList.contains('broken')) return;
      clearTimeout(timer);
      seal.classList.remove('pressing');
    };
    seal.addEventListener('pointerdown', start);
    for (const t of ['pointerup', 'pointerleave', 'pointercancel']) seal.addEventListener(t, stop);
    seal.addEventListener('contextmenu', (e) => e.preventDefault());
    seal.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && !e.repeat && start(e));
    seal.addEventListener('keyup', stop);
  });
}
