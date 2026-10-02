// Áp dụng kiểu chữ người tạo đã chọn: tải font từ Google Fonts (chỉ khi cần) và đặt biến --hand cho cả trang,
// để chữ trong thiệp lẫn màn hiệu ứng toàn màn hình (canvas) đều dùng đúng kiểu đó.
import { FONTS, fontInfo, fontStack } from '../shared/fonts.js';

const loaded = new Set();

/** Thêm thẻ <link> tải các font (gộp một lần gọi). */
export function loadFonts(ids) {
  const queries = ids.map((id) => fontInfo(id)).filter((f) => f.query && !loaded.has(f.id));
  if (!queries.length) return;
  queries.forEach((f) => loaded.add(f.id));
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${queries.map((f) => `family=${f.query}`).join('&')}&display=swap&subset=vietnamese`;
  document.head.append(link);
}

/** Tải hết các kiểu (dùng ở trình tạo để hiện mẫu chữ). */
export const loadAllFonts = () => loadFonts(FONTS.map((f) => f.id));

/** Dùng kiểu chữ id cho cả trang; chờ font tải xong tối đa 1,5 giây để khỏi nháy chữ. */
export async function applyFont(id) {
  const f = fontInfo(id);
  loadFonts([f.id]);
  document.documentElement.style.setProperty('--hand', fontStack(f.id));
  if (!document.fonts?.load) return;
  await Promise.race([document.fonts.load(`40px '${f.family}'`, 'Ơ ư ệ').catch(() => {}), new Promise((r) => setTimeout(r, 1500))]);
}

/** Font viết tay hiện tại (để vẽ chữ lên canvas). */
export function handFamily() {
  return getComputedStyle(document.documentElement).getPropertyValue('--hand').trim() || "'Dancing Script', cursive";
}
