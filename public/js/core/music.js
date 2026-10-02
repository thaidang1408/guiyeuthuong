// Nhạc nền: chỉ phát sau khi người xem chạm màn hình (quy định autoplay), có nút tắt/bật.
import { el } from './dom.js';
import { setSfxMuted } from './sfx.js';

/**
 * src: đường dẫn file nhạc (có sẵn, tự tải lên, hoặc blob URL khi xem trước); null = không nhạc.
 * Nút 🔊 tắt/bật cả nhạc nền lẫn tiếng hiệu ứng (sfx.js).
 */
export function createMusicPlayer(src) {
  const audio = src ? new Audio(src) : null;
  if (audio) {
    audio.loop = true;
    audio.preload = 'none';
    audio.volume = 0.8; // nhỏ hơn một chút để nghe rõ tiếng hiệu ứng
  }
  let muted = false;

  const button = el('button', {
    class: 'music-toggle',
    text: '🔊',
    attrs: { type: 'button', 'aria-label': 'Tắt nhạc' },
    on: {
      click: (e) => {
        e.stopPropagation();
        muted = !muted;
        setSfxMuted(muted);
        if (muted) audio?.pause();
        else audio?.play().catch(() => {});
        button.textContent = muted ? '🔇' : '🔊';
        button.setAttribute('aria-label', muted ? 'Bật nhạc' : 'Tắt nhạc');
      },
    },
  });

  // Tạm dừng khi chuyển sang ứng dụng khác, phát lại khi quay về.
  document.addEventListener('visibilitychange', () => {
    if (!audio) return;
    if (document.hidden) audio.pause();
    else if (!muted && audio.currentTime > 0) audio.play().catch(() => {});
  });

  return {
    button,
    /** Đang nghe lời nhắn giọng nói: nhạc nền nhỏ lại cho dễ nghe. */
    duck(on) {
      if (audio) audio.volume = on ? 0.12 : 0.8;
    },
    /** Gọi bên trong sự kiện chạm/bấm của người dùng. */
    start() {
      if (!muted) audio?.play().catch(() => {});
    },
  };
}
