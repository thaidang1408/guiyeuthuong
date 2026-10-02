// Khung "Link mời ký tên" của thiệp nhóm: người tổ chức gửi link này vào nhóm Zalo/Messenger.
// Mã mời tính ra từ mã sửa thiệp nên chỉ người tổ chức có; server chỉ lưu bản băm.
import { copyText, el } from '../core/dom.js';
import { inviteTokenFromEditToken } from '../shared/combo.js';

export function invitePanel({ slug, editToken, groupName }) {
  const linkBox = el('p', { class: 'link-box', text: '…' });
  const actions = el('div', { class: 'share-actions' });
  const panel = el('section', { class: 'panel combo-panel' }, [
    el('h2', { text: '✍️ Link mời cả nhóm ký tên' }),
    el('p', {
      class: 'small',
      text: `Gửi link này vào nhóm Zalo/Messenger${groupName ? ` của ${groupName}` : ''}. Mỗi người mở link, ghi tên và một lời chúc. Người nhận mở thiệp sẽ thấy tất cả.`,
    }),
    linkBox,
    actions,
    el('p', { class: 'muted small', text: 'Đừng gửi link này cho người nhận để giữ bất ngờ nhé. Chưa thanh toán vẫn gom chữ ký được.' }),
  ]);
  inviteTokenFromEditToken(editToken).then((token) => {
    const link = `${location.origin}/ky/${slug}#${token}`;
    linkBox.textContent = link;
    actions.append(
      el('button', { class: 'btn btn-primary btn-sm', text: '📋 Sao chép link mời', attrs: { type: 'button' }, on: { click: () => copyText(link) } }),
      navigator.share
        ? el('button', {
            class: 'btn btn-soft btn-sm',
            text: '📤 Gửi vào nhóm',
            attrs: { type: 'button' },
            on: { click: () => navigator.share({ title: 'Cùng ký tên vào thiệp nhé!', text: '✍️ Ký tên và viết một lời chúc vào thiệp chung nha:', url: link }).catch(() => {}) },
          })
        : '',
    );
  });
  return panel;
}
