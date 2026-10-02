// Sticker trong thiệp: mỗi sticker "bật" ra to ở nửa trên màn hình kèm câu chữ và tiếng "pop"
// (chạm xuyên qua được, không chặn nút bấm của thiệp), rồi thu nhỏ bay vào mép phải và nép một nửa
// ra ngoài màn hình như đang "nhìn trộm" để không che nội dung. Chạm vào là nhảy ra, nảy lên rồi nép lại.
// Chỉ animate transform/opacity để mượt trên điện thoại.
import { el } from '../core/dom.js';
import { sfx } from '../core/sfx.js';
import { stickerById, stickerSrc } from '../shared/stickers.js';

const BIG = 150;
const SMALL = 56;
/** Tâm sticker lúc bật ra, tính theo chiều cao màn hình (khớp với top trong card.css). */
const POP_Y = 0.24;

/** Trả về { next() } — mỗi lần gọi bật sticker kế tiếp (hết thì thôi). */
export function stickerLayer(ids) {
  const list = ids.map(stickerById).filter(Boolean);
  // Tải sẵn ảnh để lúc bật không bị trống.
  for (const s of list) new Image().src = stickerSrc(s.id);
  let shown = 0;
  let queue = Promise.resolve();

  const popOne = (s, slot) =>
    new Promise((done) => {
      const img = el('img', { attrs: { src: stickerSrc(s.id), alt: s.emoji, width: String(BIG), height: String(BIG), draggable: 'false' } });
      const cap = el('span', { class: 'stk-cap', text: s.text });
      const node = el('button', { class: 'stk', attrs: { type: 'button', 'aria-label': `${s.emoji} ${s.text}` } }, [img, cap]);
      document.body.append(node);
      sfx.pop();
      requestAnimationFrame(() => node.classList.add('in'));
      // Sau một lúc: thu nhỏ, bay vào mép phải (xếp chồng theo thứ tự), rồi nép một nửa ra ngoài.
      let tuckTimer = 0;
      const tuck = () => {
        clearTimeout(tuckTimer);
        tuckTimer = setTimeout(() => node.classList.add('tucked'), 2600);
      };
      setTimeout(() => {
        const dockY = innerHeight * 0.34 + slot * (SMALL + 12);
        const dx = innerWidth / 2 - SMALL / 2 - 4;
        const dy = dockY - innerHeight * POP_Y;
        const k = SMALL / BIG;
        node.style.setProperty('--dock', `translate(${dx}px, ${dy}px) scale(${k})`);
        node.style.setProperty('--tuck', `translate(${dx + SMALL * 0.5}px, ${dy}px) scale(${k}) rotate(-14deg)`);
        node.classList.add('docked');
        tuck();
        setTimeout(done, 500);
      }, 2000);
      node.addEventListener('click', () => {
        if (!node.classList.contains('docked')) return;
        node.classList.remove('tucked', 'hop');
        void node.offsetWidth; // chạy lại hiệu ứng nảy
        node.classList.add('hop');
        sfx.boing();
        tuck();
      });
    });

  return {
    next() {
      if (shown >= list.length) return;
      const s = list[shown];
      const slot = shown++;
      queue = queue.then(() => popOne(s, slot));
    },
    /** Bật hết những sticker còn lại (cuối thiệp). */
    rest() {
      while (shown < list.length) this.next();
    },
  };
}

/** Hàng sticker cho người nhận thả lại (cuối thiệp). onPick(id) trả Promise. */
export function stickerReplyRow(ids, onPick) {
  const row = el('div', { class: 'stk-reply' });
  for (const id of ids) {
    const s = stickerById(id);
    if (!s) continue;
    const btn = el('button', { class: 'stk-reply-btn', attrs: { type: 'button', 'aria-label': `${s.emoji} ${s.text}` } }, [
      el('img', { attrs: { src: stickerSrc(id, true), alt: '', width: '56', height: '56', loading: 'lazy' } }),
    ]);
    btn.addEventListener('click', async () => {
      for (const b of row.children) b.disabled = true;
      btn.querySelector('img').src = stickerSrc(id); // chạy động khi chọn
      btn.classList.add('picked');
      sfx.pop();
      try {
        await onPick(id);
      } catch {
        for (const b of row.children) b.disabled = false;
        btn.classList.remove('picked');
      }
    });
    row.append(btn);
  }
  return row;
}
