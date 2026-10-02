// STICKER DỄ THƯƠNG (dùng chung cho trình duyệt và server).
// Ảnh: emoji động Noto của Google, giấy phép CC BY 4.0 (ghi nguồn ở trang Điều khoản).
// File ở public/stickers/<id>.webp (động, 120px) và <id>-tinh.webp (ảnh tĩnh nhỏ cho khung chọn).
// Thêm sticker mới: tạo 2 file ảnh như trên rồi thêm một dòng ở đây.

export const STICKERS = [
  { id: 'iu', emoji: '🥰', text: 'Iu quá trời' },
  { id: 'thuong', emoji: '🫶', text: 'Thương nhiều' },
  { id: 'moa', emoji: '😘', text: 'Moa moa' },
  { id: 'rung-rung', emoji: '🥹', text: 'Rưng rưng luôn' },
  { id: 'nan-ni', emoji: '🥺', text: 'Đừng giận nữa mà' },
  { id: 'me', emoji: '😍', text: 'Mê ghê' },
  { id: 'ngai', emoji: '🤭', text: 'Hihi ngại ghê' },
  { id: 'che', emoji: '🙈', text: 'Ngại quá đi' },
  { id: 'om', emoji: '🤗', text: 'Ôm cái nè' },
  { id: 'hun', emoji: '💋', text: 'Hun cái nè' },
  { id: 'tim', emoji: '💖', text: 'Tặng trái tim nè' },
  { id: 'hoa', emoji: '💐', text: 'Hoa tặng nè' },
  { id: 'chuc', emoji: '🎉', text: 'Chúc mừng nha' },
  { id: 'khoc', emoji: '😭', text: 'Cảm động quá' },
  { id: 'ua', emoji: '😳', text: 'Ủa thật hả' },
  { id: 'doi', emoji: '😤', text: 'Hong chịu đâu' },
];

/** Số sticker tối đa người tạo gắn vào một thiệp. */
export const STICKER_MAX = 3;

/** Sticker người nhận thả lại cho người gửi ở cuối thiệp. */
export const REPLY_STICKERS = ['iu', 'thuong', 'rung-rung', 'khoc', 'me', 'moa', 'ngai', 'om'];

const BY_ID = new Map(STICKERS.map((s) => [s.id, s]));
export const stickerById = (id) => BY_ID.get(id) || null;

/** Đường dẫn ảnh: động (mặc định) hoặc ảnh tĩnh nhỏ cho khung chọn. */
export const stickerSrc = (id, still = false) => `/stickers/${id}${still ? '-tinh' : ''}.webp`;

/** Chỉ giữ id hợp lệ, không trùng, tối đa STICKER_MAX. */
export function pickStickers(raw) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((id) => typeof id === 'string' && BY_ID.has(id)))].slice(0, STICKER_MAX);
}
