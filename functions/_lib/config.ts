// CẤU HÌNH SERVER. Giá các gói nằm ở public/js/shared/plans.js (dùng chung với trang web).
export { PLANS, PREVIEW_MAX_IMAGES } from '../../public/js/shared/plans.js';

/** Đơn chưa trả tiền sẽ hết hạn sau bao lâu. */
export const ORDER_TTL_MS = 30 * 60 * 1000;

/** Ảnh QR chuyển khoản (tham số: acc, bank, amount, des, template). */
export const PAYMENT_QR_BASE = 'https://vietqr.app/img';

/** Đối soát qua API SePay: hỏi tối đa 1 lần mỗi khoảng này, lấy chừng này giao dịch gần nhất. */
/** Gói miễn phí của SePay nhận tối đa ngần này giao dịch tiền vào mỗi tháng (trang quản trị cảnh báo khi gần chạm). */
export const SEPAY_MONTHLY_LIMIT = 50;

export const SEPAY_SYNC = { intervalMs: 10_000, limit: 20, apiBase: 'https://my.sepay.vn/userapi' };

/** Giới hạn tạo đơn theo IP. */
export const RATE_LIMIT_ORDERS = { max: 10, windowMs: 60 * 60 * 1000 };

/** Ảnh tải lên. */
export const IMAGE_MAX_BYTES = 350 * 1024;
/** Nhạc tự tải lên: giới hạn dung lượng nằm ở public/js/shared/audio.js. Mỗi phần lưu trong D1 tối đa chừng này. */
export { MUSIC_MAX_BYTES } from '../../public/js/shared/audio.js';
import { MUSIC_MAX_BYTES } from '../../public/js/shared/audio.js';
export const MUSIC_PART_BYTES = 1_500_000;
export const UPLOAD_MAX_BYTES = 10 * IMAGE_MAX_BYTES + MUSIC_MAX_BYTES + 1024 * 1024 /* giọng nói */ + 64 * 1024;
export const DATA_JSON_MAX_CHARS = 20_000;

export const REPORT_REASON_MAX = 300;

/**
 * Từ ngữ thô tục bị chặn trong lời nhắn (so khớp nguyên từ, không phân biệt hoa thường).
 * Thêm/bớt thoải mái. Cụm nhiều chữ cũng được.
 */
export const BAD_WORDS = [
  'địt', 'đụ', 'đéo', 'đếch', 'cặc', 'lồn', 'buồi', 'đĩ', 'điếm', 'cave',
  'đm', 'đmm', 'dm', 'dmm', 'đcm', 'dcm', 'đkm', 'dkm', 'cmm', 'clm', 'clgt',
  'vcl', 'vkl', 'vl', 'vcc', 'cl', 'loz', 'cc', 'đỉ',
  'chó đẻ', 'óc chó', 'đồ chó', 'mẹ mày', 'má mày', 'con mẹ mày', 'thằng chó', 'súc vật',
];

/** Dọn dẹp mỗi lần có đơn mới (thay cho cron): thiệp nháp quá 24 giờ, thiệp hết hạn. */
export const CLEANUP = { draftAgeMs: 24 * 60 * 60 * 1000, maxDrafts: 5, maxExpired: 20 };

/** Trang quản trị: tối đa 5 lần đăng nhập sai mỗi 15 phút cho một IP; mật khẩu tối thiểu 10 ký tự. */
export const ADMIN_LOGIN_LIMIT = { max: 5, windowMs: 15 * 60 * 1000 };
export const ADMIN_PASSWORD_MIN = 10;

/** Nhập/kiểm tra mã combo: giới hạn theo IP để không ai dò được mã. */
export const COMBO_LIMIT = { max: 10, windowMs: 60 * 60 * 1000 };
export const COMBO_CHECK_LIMIT = { max: 30, windowMs: 60 * 60 * 1000 };

/** Mẫu "Đi chơi": mỗi thiệp nhận tối đa chừng này câu trả lời; mỗi IP gửi tối đa 10 câu/giờ. */
export const RESPONSES_PER_CARD = 20;
export const RESPONSE_LIMIT = { max: 10, windowMs: 60 * 60 * 1000 };
