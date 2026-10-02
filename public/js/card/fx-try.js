// Chạy thử MỘT hiệu ứng ngay trong trình tạo (không phải mở trang xem trước):
// màn mở đầu, hiệu ứng nền, màn kết, trò chơi — dùng tên, lời nhắn, ảnh của bản nháp đang làm.
// Chỉ tải khi người dùng bấm "▶ Xem", nên trang tạo thiệp vẫn nhẹ.
import { el, fillName } from '../core/dom.js';
import { applyFont } from '../core/fonts.js';
import { loadCss } from '../templates/registry.js';
import { fillPronouns } from '../shared/pronouns.js';
import { demoPhotos, finaleOptions } from './player.js';

/**
 * kind: 'opening' | 'bg' | 'finale' | 'game'
 * draft: { templateId, data, imageUrls }
 */
export async function tryEffect(kind, id, { templateId, data, imageUrls }) {
  await Promise.all([loadCss('card'), loadCss(templateId), applyFont(data.font)]);
  const name = data.recipientName?.trim() || 'Người ấy';
  const sender = data.senderName?.trim() || 'Tớ';
  const texts = Object.fromEntries(Object.entries(data.texts || {}).map(([k, v]) => [k, fillName(fillPronouns(v, data.pronoun), name)]));
  const filled = { ...data, recipientName: name, senderName: sender, texts };
  const photos = imageUrls.length ? imageUrls : demoPhotos();

  if (kind === 'finale') {
    const mod = await import(`../fx/${id}.js`);
    return mod.play({ ...finaleOptions({ imageUrls: photos }, filled, true), preview: true });
  }

  // Các loại còn lại: khung toàn màn hình mang màu của mẫu thiệp, có nút đóng.
  const stage = el('main', { class: 'card-stage' });
  const overlay = el('div', { class: `fx-try card-root theme-${templateId}`, attrs: { role: 'dialog', 'aria-label': 'Xem thử hiệu ứng' } }, [stage]);
  let closed = false;
  let done;
  const finished = new Promise((r) => (done = r));
  const close = () => {
    if (closed) return;
    closed = true;
    overlay.classList.remove('shown');
    document.body.classList.remove('fx-stage-open');
    setTimeout(() => overlay.remove(), 300);
    done();
  };
  overlay.append(el('button', { class: 'btn btn-soft btn-sm fx-try-close', text: '✕ Đóng', attrs: { type: 'button' }, on: { click: close } }));
  document.body.append(overlay);
  document.body.classList.add('fx-stage-open');
  requestAnimationFrame(() => overlay.classList.add('shown'));

  if (kind === 'opening') {
    const { runOpening } = await import('../fx/openings.js');
    runOpening(id, stage, { name, imageUrls: photos, onTouch() {} }).then(() => {
      if (closed) return;
      stage.replaceChildren(sample(name, '✨ Mở xong rồi! Từ đây người nhận sẽ xem tiếp thiệp của bạn.'));
      setTimeout(close, 1800);
    });
  } else if (kind === 'bg') {
    const { startBackground } = await import('../fx/bg.js');
    const canvas = startBackground(id);
    if (canvas) overlay.prepend(canvas);
    stage.append(sample(name, 'Hiệu ứng nền chạy suốt tấm thiệp, phía sau chữ và ảnh.'));
  } else if (kind === 'game') {
    const { gamePanel } = await import('../fx/games.js');
    const panel = gamePanel({ ...data.game, id }, { name, sender, send: null });
    stage.append(el('div', { class: 'fx-try-game' }, [panel || el('p', { text: 'Bạn thêm quà/câu hỏi trước nhé.' })]));
  }
  return finished;
}

/** Nội dung mẫu ở giữa màn hình để thấy hiệu ứng nằm sau chữ thế nào. */
function sample(name, note) {
  return el('section', { class: 'tt-screen tt-intro' }, [
    el('div', { class: 'tt-envelope', text: '💌', attrs: { 'aria-hidden': 'true' } }),
    el('p', { class: 'tt-intro-name', text: `${name} ơi,` }),
    el('p', { class: 'tt-intro-sub', text: note }),
  ]);
}
