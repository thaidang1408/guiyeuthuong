// Trang /thiep-cua-toi — danh sách thiệp đã thanh toán trên trình duyệt này (đọc từ localStorage, không gọi server).
import { copyText, el, qs } from '../core/dom.js';
import { forgetMyCard, listMyCards } from '../core/my-cards.js';
import { cardLink, manageLink } from '../core/order-store.js';
import { TEMPLATES } from '../shared/templates.js';

const box = qs('#my-cards');

function render() {
  const cards = listMyCards();
  if (!cards.length) {
    box.replaceChildren(
      el('section', { class: 'panel' }, [
        el('p', { text: 'Trình duyệt này chưa có thiệp nào.' }),
        el('p', { class: 'small muted', text: 'Thiệp được ghi nhớ sau khi bạn thanh toán hoặc mở link quản lý. Nếu bạn tạo thiệp trên máy khác, hãy mở link quản lý đã lưu, hoặc nhắn Hỗ trợ kèm mã đơn.' }),
        el('a', { class: 'btn btn-primary', text: '✨ Tạo thiệp đầu tiên', attrs: { href: '/#mau-thiep' } }),
      ]),
    );
    return;
  }
  box.replaceChildren(
    ...cards.map((c) => {
      const tpl = TEMPLATES[c.template];
      return el('section', { class: 'panel my-card' }, [
        el('h2', { text: `${tpl?.emoji || '💌'} Gửi ${c.recipientName || 'người ấy'}` }),
        el('p', { class: 'muted small', text: `${tpl?.name || ''} · lưu ngày ${new Date(c.savedAt).toLocaleDateString('vi-VN')}` }),
        el('div', { class: 'share-actions' }, [
          el('a', { class: 'btn btn-primary btn-sm', text: '📊 Trang quản lý', attrs: { href: manageLink(c.slug, c.editToken) } }),
          el('a', { class: 'btn btn-soft btn-sm', text: '👀 Xem thiệp', attrs: { href: cardLink(c.slug), target: '_blank', rel: 'noopener' } }),
          el('button', { class: 'btn btn-ghost btn-sm', text: '📋 Sao chép link thiệp', attrs: { type: 'button' }, on: { click: () => copyText(cardLink(c.slug)) } }),
          el('button', {
            class: 'btn btn-ghost btn-sm',
            text: 'Xoá khỏi danh sách',
            attrs: { type: 'button' },
            on: {
              click: () => {
                if (!confirm('Xoá thiệp này khỏi danh sách trên máy? (Thiệp vẫn còn, chỉ là máy này không nhớ link nữa.)')) return;
                forgetMyCard(c.slug);
                render();
              },
            },
          }),
        ]),
      ]);
    }),
  );
}

render();
