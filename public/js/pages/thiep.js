// Trang /t/<slug>: dữ liệu thiệp đã được server nhúng sẵn vào #card-data.
import { showCountdown } from '../card/countdown.js';
import { mountCard } from '../card/player.js';
import { el, qs } from '../core/dom.js';

const root = qs('#app');
let card = null;
try {
  card = JSON.parse(qs('#card-data').textContent || 'null');
} catch {
  card = null;
}

if (!card) {
  root.replaceChildren(
    el('main', { class: 'empty-state' }, [
      el('div', { class: 'empty-emoji', text: '🥲' }),
      el('h1', { text: 'Thiệp không tồn tại hoặc đã hết hạn' }),
      el('p', { text: 'Có thể link bị gõ sai, hoặc người gửi chưa hoàn tất thanh toán.' }),
      el('a', { class: 'btn btn-primary', text: 'Tạo thiệp của bạn', attrs: { href: '/' } }),
    ]),
  );
} else {
  const slug = encodeURIComponent(card.slug);
  const imageUrls = Array.from({ length: card.imageCount }, (_, i) => `/api/img/${slug}/${i}`);
  document.title = `💌 Gửi ${card.data.recipientName}`;
  if (card.waitUntil) {
    // Hẹn giờ mở: đếm ngược, tới giờ thì tải lại trang để server gửi nội dung thiệp.
    showCountdown(root, {
      template: card.template,
      name: card.data.recipientName,
      sender: card.data.senderName,
      openAt: card.data.openAt,
      font: card.data.font,
      waitUntil: card.waitUntil,
      serverNow: card.serverNow,
      onDone: () => location.reload(),
    });
  } else {
    // Người tạo mở phía mình của thiệp "Mở cùng nhau" (từ trang quản lý): /t/<slug>?cung=gui#<mã sửa>
    const side = new URLSearchParams(location.search).get('cung') === 'gui' && location.hash.length > 1 ? 'gui' : 'nhan';
    const editToken = side === 'gui' ? decodeURIComponent(location.hash.slice(1)) : undefined;
    if (side === 'gui') history.replaceState(null, '', location.pathname + location.search); // không để mã sửa nằm trên thanh địa chỉ
    mountCard(root, { ...card, imageUrls, musicUrl: `/api/nhac/${slug}` }, { side, editToken });
  }
}
