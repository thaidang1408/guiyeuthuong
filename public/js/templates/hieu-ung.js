// "Thiệp hiệu ứng": mở link là vào thẳng một hiệu ứng toàn màn hình (vũ trụ 3D, trái tim hạt sáng…),
// không phải đọc hết thư mới tới. Đóng hiệu ứng thì hiện lời nhắn + chữ ký, xem lại được nhiều lần.
// Code hiệu ứng nằm ở public/js/fx/<id>.js (dùng chung với trang xem thử hiệu ứng).
import { el, toast } from '../core/dom.js';
import { demoPhotos } from '../card/player.js';
import { introScreen, letter, screen, swap } from './common.js';

/** Tạo một mẫu thiệp chạy hiệu ứng effectId (registry.js gọi). */
export function forEffect(effectId, emoji) {
  return { render: (stage, ctx) => render(effectId, emoji, stage, ctx) };
}

function render(effectId, emoji, stage, ctx) {
  const { data } = ctx;
  const t = data.texts;
  const opts = {
    name: data.recipientName,
    sender: data.senderName,
    phrase: t.phrase,
    lines: (t.lines || '').split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 5),
    // Bản xem thử chưa có ảnh: dùng ảnh mẫu để thấy ảnh sẽ nằm ở đâu.
    imageUrls: ctx.imageUrls.length || !ctx.preview ? ctx.imageUrls : demoPhotos(),
    preview: !!ctx.preview,
  };

  let ended = false;
  const play = async () => {
    try {
      const mod = await import(`../fx/${effectId}.js`);
      await mod.play(opts);
    } catch {
      toast('Chưa mở được hiệu ứng, bạn thử tải lại trang nhé.');
    }
    if (!ended) showEnd();
  };

  const showEnd = () => {
    ended = true;
    const { node } = letter({ to: data.recipientName, message: t.message, signature: data.senderName });
    const replay = el('button', {
      class: 'btn btn-soft fx-replay',
      text: `${emoji} Xem lại hiệu ứng`,
      attrs: { type: 'button' },
      on: {
        click: async () => {
          replay.disabled = true;
          await play();
          replay.disabled = false;
        },
      },
    });
    swap(stage, screen('tt-fx-end', [node, replay]));
    ctx.onFinish();
  };

  swap(
    stage,
    introScreen({
      emoji,
      name: data.recipientName,
      sub: t.intro,
      button: 'Chạm để mở ✨',
      onOpen: () => {
        ctx.onStart();
        play();
      },
    }),
  );
}
