// Tạo phần tử HTML an toàn: chữ luôn gán bằng textContent, KHÔNG BAO GIỜ dùng innerHTML.

/**
 * el('button', { class: 'btn', text: 'Có', attrs: { type: 'button' }, on: { click: fn } }, [children])
 */
export function el(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  if (opts.class) node.className = opts.class;
  if (opts.text !== undefined) node.textContent = opts.text;
  if (opts.attrs) for (const [k, v] of Object.entries(opts.attrs)) node.setAttribute(k, v);
  if (opts.on) for (const [k, fn] of Object.entries(opts.on)) node.addEventListener(k, fn);
  for (const child of children) if (child) node.append(child);
  return node;
}

export const qs = (sel, root = document) => root.querySelector(sel);

// Thiệp là trải nghiệm người nhận tự mở để xem hiệu ứng. Nhiều máy Windows/điện thoại tắt "hiệu ứng động"
// mặc định (tiết kiệm pin) nên nếu tắt hẳn thì gần như ai cũng thấy thiệp đứng im. Vì vậy hiệu ứng luôn chạy,
// còn máy bật "giảm chuyển động" thì chạy nhẹ hơn (ít hạt, không rung lắc mạnh) — xem calmMotion().
export const prefersReducedMotion = () => false;
export const calmMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/**
 * Máy yếu (ít nhân CPU hoặc ít RAM): vẽ ít hạt hơn, độ nét canvas thấp hơn để hiệu ứng không khựng.
 * Trình duyệt không cho biết thì coi là máy thường.
 */
export const liteDevice = (() => {
  let v;
  return () => (v ??= (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 3);
})();
/** Số hạt/pháo: giảm một nửa khi máy bật "giảm chuyển động", bớt 1/3 trên máy yếu. */
export const motionCount = (n) => (calmMotion() ? Math.ceil(n / 2) : liteDevice() ? Math.ceil(n * 0.65) : n);
/**
 * Độ nét cho canvas toàn màn hình. Màn điện thoại thường 3x; vẽ 2x đã tốn gấp 4 lần 1x.
 * Lớp trang trí (hoa rơi, pháo, nền) để 1,5x là đủ đẹp mà nhẹ hơn ~45%; máy yếu dùng 1x.
 */
export const canvasDpr = (max = 1.5) => Math.min(window.devicePixelRatio || 1, liteDevice() ? 1 : max);

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Thông báo ngắn ở cuối màn hình. */
export function toast(message, ms = 2600) {
  const t = el('div', { class: 'toast', text: message, attrs: { role: 'status' } });
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, ms);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Trình duyệt trong Zalo/Messenger đôi khi chặn clipboard API — dùng cách cũ.
    const ta = el('textarea', { attrs: { readonly: '' } });
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast('Đã sao chép ✓');
}

/** Thay {ten} trong lời chúc bằng tên người nhận. */
export const fillName = (text, name) => text.replaceAll('{ten}', name || 'cậu');
