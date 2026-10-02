// Khung "link thiệp của bạn": sao chép, chia sẻ, mở thiệp, mã QR (gói có linkQr).
// Dùng ở trang thanh toán thành công và trang quản lý.
import { copyText, el, toast } from '../core/dom.js';
import { downloadCanvas, drawHeartQrCard, drawLinkQr } from '../core/link-qr.js';
import { cardLink } from '../core/order-store.js';
import { PLANS } from '../shared/plans.js';

export function sharePanel({ slug, plan, recipientName, senderName = '' }) {
  const link = cardLink(slug);
  const actions = el('div', { class: 'share-actions' }, [
    el('button', { class: 'btn btn-primary', text: '📋 Sao chép link', attrs: { type: 'button' }, on: { click: () => copyText(link) } }),
    navigator.share
      ? el('button', {
          class: 'btn btn-soft',
          text: '📤 Chia sẻ',
          attrs: { type: 'button' },
          on: {
            click: () =>
              navigator
                .share({ title: '💌 Bạn có một tấm thiệp', text: recipientName ? `Gửi ${recipientName} 💌` : '💌', url: link })
                .catch(() => {}),
          },
        })
      : null,
    el('a', { class: 'btn btn-ghost', text: '👀 Mở thiệp', attrs: { href: link, target: '_blank', rel: 'noopener' } }),
  ]);

  const panel = el('section', { class: 'panel' }, [
    el('h2', { text: 'Link thiệp của bạn' }),
    el('p', { class: 'link-box', text: link }),
    actions,
  ]);

  if (PLANS[plan]?.linkQr) {
    // Hai kiểu: thẻ trái tim để in kèm quà (đẹp, có tên người nhận) và mã QR vuông đơn giản.
    const STYLES = [
      { id: 'tim', label: '💗 Thẻ trái tim', draw: () => drawHeartQrCard(link, { to: recipientName, from: senderName }) },
      { id: 'vuong', label: '▪️ Mã QR đơn giản', draw: () => drawLinkQr(link, { caption: 'Quét để mở thiệp 💌' }) },
    ];
    const preview = el('div', { class: 'qr-preview' });
    let current = null;
    const show = async (style) => {
      try {
        current = await style.draw();
        current.className = 'link-qr' + (style.id === 'tim' ? ' heart' : '');
        preview.replaceChildren(current);
      } catch {
        toast('Chưa tạo được mã QR, bạn tải lại trang nhé.');
      }
    };
    const tabs = el('div', { class: 'chips qr-styles', attrs: { role: 'radiogroup' } });
    STYLES.forEach((style, i) => {
      const b = el('button', { class: 'chip' + (i === 0 ? ' selected' : ''), text: style.label, attrs: { type: 'button' } });
      b.addEventListener('click', () => {
        for (const c of tabs.children) c.classList.toggle('selected', c === b);
        show(style);
      });
      tabs.append(b);
    });
    panel.append(
      el('h3', { text: 'Mã QR để in kèm quà' }),
      el('p', { class: 'muted small', text: 'In thẻ này kẹp vào bó hoa, hộp quà. Người nhận quét bằng camera điện thoại là mở được thiệp.' }),
      tabs,
      el('div', { class: 'qr-wrap' }, [
        preview,
        el('button', {
          class: 'btn btn-soft btn-sm',
          text: '⬇️ Tải ảnh để in',
          attrs: { type: 'button' },
          on: { click: () => current && downloadCanvas(current, `thiep-${slug}.png`) },
        }),
      ]),
    );
    show(STYLES[0]);
  }
  return panel;
}
