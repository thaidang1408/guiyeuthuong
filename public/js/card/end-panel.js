// Khung cuối thiệp: "biên lai" để lưu/chia sẻ + ô viết thư đáp lại người gửi + lời mời tạo thiệp đáp lại.
// Đây là vòng lan truyền: người nhận đăng biên lai lên story, hoặc tạo thiệp gửi ngược lại.
import { replyCard } from '../core/api.js';
import { el, toast } from '../core/dom.js';
import { downloadCanvas } from '../core/link-qr.js';
import { drawReceipt } from '../core/receipt.js';

/** card: { slug, data }, receiptSpec: { title, rows, verdict } | null */
export function endPanel(card, { preview, receiptSpec }) {
  const sender = card.data.senderName;
  const panel = el('section', { class: 'end-panel' });
  if (receiptSpec) panel.append(receiptBlock(receiptSpec));
  panel.append(replyBlock(card, sender, preview));
  panel.append(
    el('div', { class: 'end-cta' }, [
      el('p', { class: 'small', text: `Đến lượt bạn làm ${sender} bất ngờ nè 💝` }),
      el('a', {
        class: 'btn btn-primary btn-lg',
        text: `💌 Gửi lại một tấm cho ${sender}`,
        attrs: { href: '/?gui-lai=1#mau-thiep' },
        // Nhớ tên hai người để trang tạo thiệp điền sẵn (đổi vai: người gửi thành người nhận).
        on: { click: () => rememberReply({ to: sender, from: card.data.recipientName }) },
      }),
    ]),
  );
  return panel;
}

export const REPLY_KEY = 'gui-lai';
function rememberReply(names) {
  try {
    sessionStorage.setItem(REPLY_KEY, JSON.stringify(names));
  } catch {
    /* trình duyệt chặn lưu tạm thì thôi, chỉ không điền sẵn tên */
  }
}

function receiptBlock(spec) {
  const block = el('div', { class: 'end-block' }, [el('h3', { text: '🧾 Biên lai của bạn' })]);
  const imgWrap = el('div', { class: 'receipt-wrap' }, [el('p', { class: 'muted small', text: 'Đang in biên lai…' })]);
  block.append(imgWrap);
  drawReceipt(spec).then((canvas) => {
    // Hiện bằng <img> để trong Zalo/Messenger nhấn giữ là lưu được ảnh.
    const img = el('img', { class: 'receipt-img', attrs: { src: canvas.toDataURL('image/png'), alt: spec.title } });
    const actions = el('div', { class: 'share-actions' });
    canvas.toBlob((blob) => {
      const file = blob && new File([blob], 'bien-lai.png', { type: 'image/png' });
      if (file && navigator.canShare?.({ files: [file] })) {
        actions.append(
          el('button', {
            class: 'btn btn-primary btn-sm',
            text: '📤 Chia sẻ lên story',
            attrs: { type: 'button' },
            on: { click: () => navigator.share({ files: [file], title: spec.title }).catch(() => {}) },
          }),
        );
      }
      actions.append(
        el('button', { class: 'btn btn-soft btn-sm', text: '⬇️ Lưu ảnh', attrs: { type: 'button' }, on: { click: () => downloadCanvas(canvas, 'bien-lai.png') } }),
      );
    });
    imgWrap.replaceChildren(img, el('p', { class: 'muted small center', text: 'Mở trong Zalo/Messenger: nhấn giữ vào ảnh để lưu.' }), actions);
  });
  return block;
}

function replyBlock(card, sender, preview) {
  const box = el('textarea', { class: 'input', attrs: { rows: '3', maxlength: '500', placeholder: `Viết vài dòng cho ${sender}…` } });
  const send = el('button', { class: 'btn btn-primary btn-sm', text: 'Gửi 💌', attrs: { type: 'submit' } });
  const form = el('form', { class: 'end-block' }, [
    el('h3', { text: `💌 Gửi lời đáp cho ${sender}` }),
    el('p', { class: 'muted small', text: `Chỉ ${sender} đọc được, ở trang quản lý thiệp.` }),
    box,
    send,
  ]);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!box.value.trim()) return box.focus();
    send.disabled = true;
    try {
      if (preview) toast('Bản xem thử: lời đáp chưa được gửi đi 😉', 3000);
      else await replyCard(card.slug, box.value);
      form.replaceChildren(el('p', { class: 'end-sent', text: `Đã gửi tới ${sender} ✓` }));
    } catch (err) {
      toast(err.message, 4000);
      send.disabled = false;
    }
  });
  return form;
}
