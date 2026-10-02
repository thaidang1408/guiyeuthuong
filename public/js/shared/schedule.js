// HẸN GIỜ MỞ THIỆP — dùng chung cho trình tạo (trình duyệt) và server.
// Giờ mở lưu dạng "YYYY-MM-DDTHH:mm" theo giờ Việt Nam (đúng định dạng của ô chọn ngày giờ trên điện thoại).

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** "2026-10-20T00:00" (giờ VN) → mili-giây UTC. Sai định dạng hoặc ngày không có thật → null. */
export function openAtMs(value) {
  const m = PATTERN.exec(typeof value === 'string' ? value : '');
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  if (y < 2024 || y > 2099 || h > 23 || mi > 59) return null;
  const ms = Date.UTC(y, mo - 1, d, h, mi);
  const check = new Date(ms);
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return ms - VN_OFFSET_MS;
}

/** mili-giây → "YYYY-MM-DDTHH:mm" theo giờ VN (để điền ô chọn giờ). */
export function toOpenAt(ms) {
  const d = new Date(ms + VN_OFFSET_MS);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/** "20:00 · 20/10/2026" để hiện cho người đọc. */
export function formatOpenAt(value) {
  const m = PATTERN.exec(value || '');
  return m ? `${m[4]}:${m[5]} · ${m[3]}/${m[2]}/${m[1]}` : '';
}
