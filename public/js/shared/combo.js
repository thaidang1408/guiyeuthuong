// MÃ COMBO — dùng chung cho trình duyệt và server.
// Mã combo được tính ra từ mã sửa (editToken) của thiệp mua combo, nên người mua luôn xem lại được
// ở trang thanh toán và trang quản lý, còn server chỉ lưu bản băm của mã (giống mã sửa).

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 ký tự, bỏ I, O, 0, 1 cho khỏi nhầm
export const COMBO_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{10}$/;

async function deriveCode(prefix, editToken, length) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(prefix + editToken)));
  let code = '';
  for (let i = 0; i < length; i++) code += ALPHABET[digest[i] & 31];
  return code;
}

/** Mã combo 10 ký tự từ mã sửa của thiệp. */
export const comboCodeFromEditToken = (editToken) => deriveCode('combo:', editToken, 10);

/** Mã mời ký tên của thiệp nhóm (16 ký tự, nằm sau dấu # của link /ky/<slug>#<mã>). */
export const inviteTokenFromEditToken = (editToken) => deriveCode('invite:', editToken, 16);
export const INVITE_TOKEN_PATTERN = /^[A-HJ-NP-Z2-9]{16}$/;

/** Bỏ dấu cách, gạch nối; viết hoa. "abcde-fghjk" → "ABCDEFGHJK". */
export const normalizeComboCode = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** "ABCDEFGHJK" → "ABCDE-FGHJK" cho dễ đọc. */
export const formatComboCode = (code) => `${code.slice(0, 5)}-${code.slice(5)}`;
