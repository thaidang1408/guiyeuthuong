// Hiển thị một tấm thiệp hoàn chỉnh: mẫu thiệp + nhạc + watermark (xem thử) + nút báo cáo + lời mời tạo thiệp.
// Dùng chung cho trang thiệp thật (/t/<slug>) và trang xem trước (/xem-truoc).
import { playGame, reactCard, reportCard, submitAnswer } from '../core/api.js';
import { el, fillName, toast } from '../core/dom.js';
import { ambientLayer, enableSparkles } from '../core/ambient.js';
import { applyFont } from '../core/fonts.js';
import { createMusicPlayer } from '../core/music.js';
import { CUSTOM_MUSIC_ID } from '../shared/audio.js';
import { FINALES, defaultPhrase } from '../shared/effects.js';
import { fillPronouns, pronounWords } from '../shared/pronouns.js';
import { skipNextIntro } from '../templates/common.js';
import { loadTemplate } from '../templates/registry.js';
import { endPanel } from './end-panel.js';
import { unlockCard } from './lock-screen.js';

/** Lời chúc mẫu cho bản xem thử thiệp nhóm (chưa ai ký). */
const DEMO_SIGNATURES = [
  { name: 'Minh Anh', message: 'Chúc mừng 20/10! Luôn xinh đẹp và vui vẻ nha 💖', sticker: '💖' },
  { name: 'Hoàng', message: 'Cảm ơn vì đã luôn quan tâm mọi người.', sticker: '🌷' },
  { name: 'Thu Trang', message: 'Mãi trẻ, mãi đẹp, mãi hạnh phúc!', sticker: '🌸' },
  { name: 'Đức', message: 'Một ngày thật nhiều hoa và quà nhé 🎉', sticker: '🎉' },
];

/**
 * card: { template, data, imageUrls, slug?, musicUrl?, voiceUrl?, signatures? }  (musicUrl: nhạc tự tải lên, voiceUrl: lời nhắn giọng nói)
 * options: { preview: boolean, backHref?: string, backText?: string, useHref?: string, side?: 'gui' | 'nhan', editToken?: string }
 *   side/editToken: "Mở cùng nhau" — người tạo mở phía mình từ trang quản lý (side 'gui' + mã sửa).
 *   useHref: bản mẫu ở trang chủ — hiện nút "Dùng mẫu này" luôn nằm cuối màn hình.
 */
export async function mountCard(root, card, { preview = false, backHref, backText = '← Sửa tiếp', useHref, side = 'nhan', editToken } = {}) {
  root.replaceChildren();
  root.className = `card-root theme-${card.template}`;

  const music = createMusicPlayer(musicSrc(card));
  const stage = el('main', { class: 'card-stage' });
  const topBar = el('div', { class: 'card-topbar' }, [
    backHref ? el('a', { class: 'chip', text: backText, attrs: { href: backHref } }) : el('span'),
    music.button,
  ]);
  const footer = el('footer', { class: 'card-footer' }, [
    el('a', { class: 'btn btn-ghost', text: '✨ Tạo thiệp của bạn', attrs: { href: '/' } }),
  ]);
  root.append(ambientLayer(), topBar, stage, footer);
  // Hiệu ứng nền người tạo chọn (đom đóm, bong bóng…): chỉ tải code khi có dùng, nằm ngay sau quầng sáng.
  if (card.data.fx?.bg) import('../fx/bg.js').then(({ startBackground }) => root.firstChild.after(startBackground(card.data.fx.bg) || ''));
  enableSparkles(root);

  if (preview) root.append(watermark());
  if (useHref) {
    root.classList.add('has-use-cta');
    root.append(el('a', { class: 'btn btn-primary btn-lg use-cta', text: '💌 Dùng mẫu này', attrs: { href: useHref } }));
  }
  else root.append(el('button', { class: 'report-link', text: 'Báo cáo thiệp', attrs: { type: 'button' }, on: { click: () => openReport(card.slug) } }));

  // Mọi câu chữ đều có thể chứa {ten} → thay bằng tên người nhận trước khi hiển thị.
  const texts = Object.fromEntries(
    Object.entries(card.data.texts || {}).map(([k, v]) => [k, fillName(fillPronouns(v, card.data.pronoun), card.data.recipientName)]),
  );
  const [tpl] = await Promise.all([loadTemplate(card.template), applyFont(card.data.font)]);
  // Khóa câu hỏi bí mật (nếu người tạo có đặt): trả lời đúng + phá dấu niêm phong mới vào thiệp.
  if (card.data.lock) await unlockCard(stage, card.data.lock, { recipientName: card.data.recipientName });

  // Mở cùng nhau: chờ cả hai cùng bấm sẵn sàng rồi mới vào thiệp.
  if (card.data.together) {
    const { togetherGate } = await import('./together.js');
    const [me, other] = side === 'gui' ? [card.data.senderName, card.data.recipientName] : [card.data.recipientName, card.data.senderName];
    await togetherGate(stage, { slug: card.slug, side, editToken, me, other, preview, onTouch: () => music.start() });
  }

  // Quay phản ứng (người tạo có xin): hỏi ý người nhận, đồng ý thì quay 15 giây trong lúc mở thiệp.
  if (card.data.reactionCam && side === 'nhan') {
    const { askReaction, setReactionTarget } = await import('./reaction-cam.js');
    setReactionTarget({ slug: card.slug, preview });
    const start = await askReaction(stage, { sender: card.data.senderName, onTouch: () => music.start() });
    if (start) {
      start();
      skipNextIntro(); // đã chạm rồi, vào thẳng thiệp cho kịp quay khoảnh khắc mở
    }
  }

  // Hiệu ứng đặc biệt (mở đầu / màn kết) — chỉ tải code khi thiệp có dùng.
  const fx = card.data.fx || {};
  if (fx.opening) {
    const { runOpening } = await import('../fx/openings.js');
    const imageUrls = card.imageUrls.length || !preview ? card.imageUrls : demoPhotos();
    await runOpening(fx.opening, stage, { name: card.data.recipientName, imageUrls, onTouch: () => music.start() });
    skipNextIntro();
  }

  let reaction = null; // { noPresses, thinkMs, extra } khi người nhận bấm "Có"/"Tha"/hoàn thành
  const react = (stats = {}) => {
    if (reaction) return;
    reaction = { noPresses: stats.noPresses ?? 0, thinkMs: stats.thinkMs ?? 0, extra: stats.extra ?? {} };
    if (!preview) reactCard(card.slug, { noPresses: reaction.noPresses, thinkMs: reaction.thinkMs }).catch(() => {});
  };
  // pr: từ xưng hô ({ toi, ban, Toi, Ban }) để mẫu thiệp ghép câu, ví dụ "tớ có chuyện muốn nói với cậu".
  const data = { ...card.data, texts, pr: pronounWords(card.data.pronoun) };
  tpl.render(stage, {
    data,
    slug: card.slug,
    preview,
    imageUrls: card.imageUrls,
    signatures: card.signatures ?? (preview ? DEMO_SIGNATURES : []),
    onStart: () => music.start(),
    onYes: react,
    onFinish: () => {
      react(); // mẫu không có câu hỏi: xem hết thiệp cũng là một phản ứng
      footer.classList.add('shown');
      // Lời nhắn giọng nói: hiện ngay sau thiệp, trước trò chơi.
      const voiceSrc = card.voiceUrl || (card.data.voice && card.slug ? `/api/giong-noi/${encodeURIComponent(card.slug)}` : null);
      if (voiceSrc) {
        const slot = el('div');
        stage.append(slot); // giữ chỗ để lời nhắn nằm trên trò chơi và phần cuối thiệp
        import('./voice.js').then(({ voicePlayer }) => slot.replaceWith(voicePlayer(voiceSrc, { sender: data.senderName, music })));
      }
      if (card.data.game?.id) mountGame(stage, card, data, preview);
      if (fx.finale) stage.append(finaleButton(fx.finale, finaleOptions(card, data, preview)));
      stage.append(endPanel(card, { preview, receiptSpec: tpl.receipt?.(data, reaction) ?? null }));
    },
    // Mẫu có ô trả lời (Đi chơi): bản xem thử không gửi gì lên server.
    onAnswer: preview
      ? async () => toast('Bản xem thử: câu trả lời chưa được gửi đi 😉', 3000)
      : (answer) => submitAnswer(card.slug, answer),
  });
}

/** Trò chơi cuối thiệp (vòng quay, câu đố). Gắn trước nút bất ngờ để giữ đúng thứ tự trên trang. */
function mountGame(stage, card, data, preview) {
  const slot = el('div', { class: 'gm-slot' });
  stage.append(slot);
  import('../fx/games.js').then(({ gamePanel }) => {
    const send = preview ? null : (body) => playGame(card.slug, body);
    const panel = gamePanel(card.data.game, { name: data.recipientName, sender: data.senderName, send });
    if (panel) slot.replaceWith(panel);
  });
}

/** Nút "Còn một bất ngờ nữa…" mở màn kết toàn màn hình (xem lại được nhiều lần). */
function finaleButton(id, opts) {
  const info = FINALES.find((f) => f.id === id);
  const btn = el('button', {
    class: 'btn btn-primary btn-lg fx-surprise',
    text: '🎁 Còn một bất ngờ nữa…',
    attrs: { type: 'button' },
    on: {
      click: async () => {
        btn.disabled = true;
        try {
          const mod = await import(`../fx/${id}.js`);
          await mod.play(opts);
          btn.textContent = `${info?.emoji || '✨'} Xem lại bất ngờ`;
        } catch {
          toast('Chưa mở được hiệu ứng, bạn thử lại nhé.');
        }
        btn.disabled = false;
      },
    },
  });
  return el('div', { class: 'fx-surprise-wrap' }, [btn]);
}

/** Dữ liệu cho màn kết: tên, câu yêu thương, vài câu ngắn trích từ lời nhắn, ảnh. */
export function finaleOptions(card, data, preview) {
  const name = data.recipientName;
  const phrase = fillName(data.fx?.phrase || '', name) || defaultPhrase(name);
  const lines = Object.values(data.texts)
    .filter((v) => v && !/^\d{4}-\d{2}-\d{2}$/.test(v))
    .flatMap((v) => v.split(/[.!?…]+\s+|\n+/)) // không dùng lookbehind: Safari cũ chưa hỗ trợ
    .map((s) => s.trim())
    .filter((s) => [...s].length >= 6 && [...s].length <= 30);
  const imageUrls = card.imageUrls.length || !preview ? card.imageUrls : demoPhotos();
  return { name, sender: data.senderName, phrase, lines: lines.slice(0, 5), imageUrls, preview };
}

/** Bản xem thử chưa có ảnh: dùng vài "ảnh mẫu" vẽ tạm để thấy ảnh sẽ nằm ở đâu. */
export function demoPhotos() {
  return [['💑', '#ff8fab', '#ffd166'], ['🌸', '#ffafcc', '#cdb4db'], ['☕', '#ffd6a5', '#ff8fab'], ['🎡', '#a0e7e5', '#ffafcc'], ['🌅', '#ffb703', '#fb6f92']].map(
    ([emoji, a, b]) => {
      const c = document.createElement('canvas');
      c.width = c.height = 240;
      const g = c.getContext('2d');
      const grad = g.createLinearGradient(0, 0, 240, 240);
      grad.addColorStop(0, a);
      grad.addColorStop(1, b);
      g.fillStyle = grad;
      g.fillRect(0, 0, 240, 240);
      g.font = '96px serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(emoji, 120, 108);
      g.font = "600 20px 'Be Vietnam Pro', sans-serif";
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.fillText('Ảnh của bạn', 120, 200);
      return c.toDataURL('image/png');
    },
  );
}

function musicSrc(card) {
  const id = card.data.music;
  if (id === CUSTOM_MUSIC_ID) return card.musicUrl || null;
  return id && id !== 'none' ? `/music/${id}.mp3` : null;
}

function watermark() {
  const wrap = el('div', { class: 'watermark', attrs: { 'aria-hidden': 'true' } });
  for (let i = 0; i < 24; i++) wrap.append(el('span', { text: 'Bản xem thử' }));
  return wrap;
}

function openReport(slug) {
  const reason = el('textarea', { class: 'input', attrs: { rows: '3', maxlength: '300', placeholder: 'Thiệp này có vấn đề gì vậy?' } });
  const close = () => overlay.remove();
  const send = el('button', {
    class: 'btn btn-primary',
    text: 'Gửi báo cáo',
    attrs: { type: 'button' },
    on: {
      click: async () => {
        send.disabled = true;
        try {
          await reportCard(slug, reason.value);
          close();
          toast('Cảm ơn bạn, mình sẽ xem xét sớm.');
        } catch (e) {
          toast(e.message);
          send.disabled = false;
        }
      },
    },
  });
  const overlay = el('div', { class: 'modal-backdrop', on: { click: (e) => e.target === overlay && close() } }, [
    el('div', { class: 'modal', attrs: { role: 'dialog', 'aria-label': 'Báo cáo thiệp' } }, [
      el('h2', { text: 'Báo cáo thiệp' }),
      reason,
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn btn-ghost', text: 'Huỷ', attrs: { type: 'button' }, on: { click: close } }),
        send,
      ]),
    ]),
  ]);
  document.body.append(overlay);
  reason.focus();
}
