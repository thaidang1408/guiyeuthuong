// Khung "Lưu link quản lý" sau khi thanh toán: gửi link cho chính mình (Zalo "Cloud của tôi", Messenger…),
// sao chép, và nút "Mình đã lưu rồi". Khung nhấp nháy cho tới khi người tạo xác nhận đã lưu.
import { copyText, el, toast } from '../core/dom.js';
import { listMyCards, markManageSaved } from '../core/my-cards.js';

/** { slug, manage: link quản lý, recipientName, canEdit } */
export function manageSavePanel({ slug, manage, recipientName, canEdit }) {
  const saved = listMyCards().find((c) => c.slug === slug)?.saved;
  const panel = el('section', { class: 'panel panel-warn manage-save' + (saved ? '' : ' unsaved') });
  const confirm = el('button', {
    class: 'btn btn-primary btn-sm',
    text: '✅ Mình đã lưu rồi',
    attrs: { type: 'button' },
    on: {
      click: () => {
        markManageSaved(slug);
        panel.classList.remove('unsaved');
        confirm.replaceWith(el('p', { class: 'small saved-ok', text: '✅ Đã lưu. Thiệp cũng nằm trong mục "Thiệp của tôi" trên trình duyệt này.' }));
      },
    },
  });
  const shareSelf = navigator.share
    ? el('button', {
        class: 'btn btn-primary',
        text: '📤 Gửi link quản lý cho chính mình',
        attrs: { type: 'button' },
        on: {
          click: () =>
            navigator
              .share({ title: 'Link quản lý thiệp (đừng gửi cho người nhận)', text: `🔑 Link quản lý thiệp gửi ${recipientName} — chỉ mình mình giữ:`, url: manage })
              .then(() => toast('Đã gửi! Nhớ bấm "Mình đã lưu rồi" nhé.'))
              .catch(() => {}),
        },
      })
    : null;
  panel.append(
    el('h2', { text: '🔑 Lưu link quản lý — quan trọng!' }),
    el('p', {
      class: 'small',
      text: `Link này để xem ${recipientName} mở thiệp lúc nào, phản ứng ra sao, nhắn gì lại cho bạn${canEdit ? ', sửa lời nhắn' : ''}. Mất link là không xem được nữa, và đừng gửi link này cho người nhận.`,
    }),
    el('p', { class: 'small tip', text: '💡 Mẹo: gửi vào Zalo "Cloud của tôi" hoặc tin nhắn cho chính mình là chắc ăn nhất.' }),
    el('p', { class: 'link-box', text: manage }),
    el('div', { class: 'share-actions' }, [
      shareSelf,
      el('button', { class: 'btn btn-soft', text: 'Sao chép link quản lý', attrs: { type: 'button' }, on: { click: () => copyText(manage) } }),
      el('a', { class: 'btn btn-ghost', text: 'Mở trang quản lý', attrs: { href: manage } }),
    ]),
    saved ? el('p', { class: 'small saved-ok', text: '✅ Bạn đã lưu link này.' }) : confirm,
  );
  return panel;
}
