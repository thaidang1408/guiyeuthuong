// KHÓA CÂU HỎI BÍ MẬT — người nhận phải trả lời đúng mới mở được thiệp.
// Đây là trò vui (đáp án so trên máy người xem), không phải bảo mật thật; thiệp vẫn nằm sau link khó đoán.

/** Bỏ dấu, viết thường, gộp khoảng trắng: "Hà  Nội!" → "ha noi". */
export function normalizeAnswer(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Bản băm của đáp án (lưu thay cho đáp án thật). */
export async function hashAnswer(answer) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('lock:' + normalizeAnswer(answer)));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const LOCK_LIMITS = { question: 100, hint: 60, answer: 40 };
