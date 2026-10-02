// Trang /ho-tro: hiện nút Zalo hỗ trợ (số lấy từ server, đổi trong biến SUPPORT_ZALO).
import { copyText, el, qs } from '../core/dom.js';

const box = qs('#zalo-box');

async function start() {
  let zalo = null;
  try {
    zalo = (await (await fetch('/api/ho-tro')).json()).zalo;
  } catch {
    zalo = null;
  }
  if (!zalo) {
    box.replaceChildren(el('p', { class: 'small', text: 'Kênh hỗ trợ đang được cập nhật, bạn quay lại sau ít phút nhé.' }));
    return;
  }
  box.replaceChildren(
    el('div', { class: 'share-actions' }, [
      el('a', { class: 'btn btn-primary', text: `💬 Nhắn Zalo ${zalo}`, attrs: { href: `https://zalo.me/${zalo}`, target: '_blank', rel: 'noopener' } }),
      el('button', { class: 'btn btn-soft', text: 'Sao chép số', attrs: { type: 'button' }, on: { click: () => copyText(zalo) } }),
    ]),
  );
}

start();
