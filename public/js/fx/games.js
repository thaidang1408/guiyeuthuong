// Trò chơi cuối thiệp: vòng quay quà tặng và câu đố "Bạn hiểu tớ bao nhiêu?".
// Thiệp thật: server bốc thăm/chấm điểm và lưu lại cho người tạo xem. Bản xem thử: chạy hoàn toàn trên máy.
import { confettiCannon } from '../core/confetti.js';
import { el, toast, wait } from '../core/dom.js';
import { burstHearts } from '../core/hearts.js';
import { quizVerdict } from '../shared/games.js';

const COLORS = ['#ff5c8a', '#ffb347', '#ff8fab', '#ffd166', '#f78fb3', '#ffa07a'];

/**
 * game: { id, prizes?, quiz? }
 * ctx: { name, sender, send(body) → Promise<kết quả> | null (bản xem thử) }
 */
export function gamePanel(game, ctx) {
  if (game.id === 'vong-quay' && game.prizes?.length) return wheel(game.prizes, ctx);
  if (game.id === 'cau-do' && game.quiz?.length) return quiz(game.quiz, ctx);
  return null;
}

// ---------- Vòng quay ----------

function wheel(prizes, ctx) {
  const n = prizes.length;
  const slice = 360 / n;
  const disc = el('div', { class: 'gm-wheel-disc' });
  // Nền các ô màu bằng conic-gradient, chữ là các span xoay theo góc giữa mỗi ô.
  disc.style.background = `conic-gradient(${prizes.map((_, i) => `${COLORS[i % COLORS.length]} ${i * slice}deg ${(i + 1) * slice}deg`).join(', ')})`;
  prizes.forEach((p, i) => {
    const label = el('span', { class: 'gm-wheel-label', text: p });
    label.style.transform = `rotate(${i * slice + slice / 2}deg)`;
    disc.append(label);
  });
  const spin = el('button', { class: 'btn btn-primary btn-lg gm-spin', text: 'QUAY 🎡', attrs: { type: 'button' } });
  const result = el('div', { class: 'gm-result', attrs: { 'aria-live': 'polite' } });
  const box = el('section', { class: 'gm-panel' }, [
    el('h3', { text: `🎁 ${ctx.sender} tặng ${ctx.name} một lượt quay` }),
    el('p', { class: 'muted small', text: 'Chỉ được quay 1 lần thôi nha. Trúng gì, người gửi phải thực hiện cái đó!' }),
    el('div', { class: 'gm-wheel' }, [el('span', { class: 'gm-pointer', attrs: { 'aria-hidden': 'true' } }), disc, el('span', { class: 'gm-hub', text: '💝' })]),
    spin,
    result,
  ]);

  spin.addEventListener('click', async () => {
    spin.disabled = true;
    let index;
    let prize;
    try {
      const r = ctx.send ? await ctx.send({ kind: 'vong-quay' }) : { index: Math.floor(Math.random() * n) };
      index = r.index;
      prize = prizes[index] ?? r.prize;
    } catch (e) {
      toast(e.message || 'Chưa quay được, thử lại nhé.');
      spin.disabled = false;
      return;
    }
    // Kim ở đỉnh (0°). Ô i nằm ở [i*slice, (i+1)*slice] theo chiều kim đồng hồ → quay ngược lại để ô đó về đỉnh.
    const jitter = (Math.random() - 0.5) * slice * 0.6;
    const target = 360 * 6 - (index * slice + slice / 2) + jitter;
    disc.style.transform = `rotate(${target}deg)`;
    spin.textContent = 'Đang quay…';
    await wait(5200);
    disc.classList.add('done');
    spin.remove();
    navigator.vibrate?.([30, 40, 80]);
    confettiCannon({ count: 120 });
    result.replaceChildren(
      el('p', { class: 'gm-prize-label', text: `${ctx.name} trúng:` }),
      el('p', { class: 'gm-prize', text: prize }),
      el('p', { class: 'muted small', text: ctx.send ? `${ctx.sender} đã nhận được kết quả, nhớ đòi quà nha 😎` : 'Bản xem thử: kết quả chưa được lưu.' }),
    );
  });
  return box;
}

// ---------- Câu đố ----------

function quiz(questions, ctx) {
  const answers = [];
  let score = 0;
  const body = el('div', { class: 'gm-quiz-body' });
  const dots = el('div', { class: 'gm-dots', attrs: { 'aria-hidden': 'true' } }, questions.map(() => el('span')));
  const box = el('section', { class: 'gm-panel' }, [
    el('h3', { text: `💯 ${ctx.name} hiểu ${ctx.sender} bao nhiêu?` }),
    dots,
    body,
  ]);

  const show = (i) => {
    const q = questions[i];
    dots.children[i]?.classList.add('now');
    const opts = q.options.map((o, k) =>
      el('button', {
        class: 'gm-option',
        text: o,
        attrs: { type: 'button' },
        on: { click: () => pick(i, k, opts) },
      }),
    );
    body.replaceChildren(el('p', { class: 'gm-q', text: `Câu ${i + 1}/${questions.length}: ${q.q}` }), el('div', { class: 'gm-options' }, opts));
  };

  const pick = async (i, k, opts) => {
    opts.forEach((b) => (b.disabled = true));
    const right = k === questions[i].answer;
    answers.push(k);
    if (right) score++;
    opts[k].classList.add(right ? 'right' : 'wrong');
    if (!right) opts[questions[i].answer].classList.add('right');
    dots.children[i].className = right ? 'ok' : 'no';
    navigator.vibrate?.(right ? 20 : [20, 40, 20]);
    await wait(1100);
    if (i + 1 < questions.length) return show(i + 1);
    finish();
  };

  const finish = async () => {
    body.replaceChildren(el('p', { class: 'muted', text: 'Đang chấm điểm…' }));
    let total = questions.length;
    try {
      if (ctx.send) ({ score, total } = await ctx.send({ kind: 'cau-do', answers }));
    } catch (e) {
      toast(e.message || 'Chưa gửi được kết quả.');
    }
    (score / total >= 0.6 ? confettiCannon : burstHearts)({ count: 90 });
    body.replaceChildren(
      el('p', { class: 'gm-score', text: `${score}/${total}` }),
      el('p', { class: 'gm-verdict', text: quizVerdict(score, total) }),
      el('p', { class: 'muted small', text: ctx.send ? `${ctx.sender} sẽ xem được từng câu trả lời của bạn 👀` : 'Bản xem thử: kết quả chưa được lưu.' }),
    );
  };

  show(0);
  return box;
}
