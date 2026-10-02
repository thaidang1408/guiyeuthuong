// Trình chiếu ảnh: tự chuyển, chạm hoặc vuốt để đổi ảnh.
import { el, prefersReducedMotion } from './dom.js';

export function createSlideshow(urls, { interval = 3500 } = {}) {
  const slides = urls.map((src, i) =>
    el('img', { class: 'slide' + (i === 0 ? ' active' : ''), attrs: { src, alt: `Ảnh ${i + 1}`, decoding: 'async', loading: i === 0 ? 'eager' : 'lazy' } }),
  );
  const dots = urls.map((_, i) => el('span', { class: 'dot' + (i === 0 ? ' active' : '') }));
  const root = el('div', { class: 'slideshow' }, [...slides, urls.length > 1 ? el('div', { class: 'dots' }, dots) : null]);
  if (urls.length < 2) return root;

  let current = 0;
  let timer;
  const show = (i) => {
    slides[current].classList.remove('active');
    dots[current].classList.remove('active');
    current = (i + urls.length) % urls.length;
    slides[current].classList.add('active');
    dots[current].classList.add('active');
    restart();
  };
  const restart = () => {
    clearInterval(timer);
    if (!prefersReducedMotion()) timer = setInterval(() => show(current + 1), interval);
  };

  let startX = null;
  root.addEventListener('pointerdown', (e) => (startX = e.clientX));
  root.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    show(Math.abs(dx) > 40 ? current + (dx < 0 ? 1 : -1) : current + 1);
  });
  restart();
  return root;
}
