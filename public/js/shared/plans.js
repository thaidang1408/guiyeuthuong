// BẢNG GIÁ — sửa ở đây là đổi cho cả trang web lẫn server.
// File này dùng chung: trình duyệt hiển thị giá, server tính tiền và kiểm tra giới hạn.
import { CUSTOM_MUSIC_ID } from './audio.js';

export const PLANS = {
  'co-ban': {
    id: 'co-ban',
    name: 'Cơ bản',
    price: 15000,
    maxImages: 3,
    days: 30,
    canEditAfterSend: false,
    linkQr: false,
    extras: false,
    maxSignatures: 15,
  },
  'dac-biet': {
    id: 'dac-biet',
    name: 'Đặc biệt',
    price: 29000,
    maxImages: 10,
    days: 365,
    canEditAfterSend: true,
    linkQr: true,
    extras: true,
    maxSignatures: 50,
  },
  // Combo mùa lễ: trả một lần, được `cards` thiệp, mỗi thiệp đủ quyền gói Đặc biệt.
  // Thiệp đầu tiên dùng gói này; các thiệp sau nhập "mã combo" (gói Đặc biệt, 0đ).
  combo: {
    id: 'combo',
    name: 'Combo 20/10',
    price: 49000,
    maxImages: 10,
    days: 365,
    canEditAfterSend: true,
    linkQr: true,
    extras: true,
    maxSignatures: 50,
    cards: 3,
  },
};

/**
 * TÍNH NĂNG CAO CẤP: chỉ gói có `extras: true` (Đặc biệt, Combo) mới dùng được.
 * Server chặn khi tạo đơn / đổi gói; trình tạo gắn nhãn "💎 Gói Đặc biệt" và khóa gói Cơ bản khi đang dùng.
 */
export const PREMIUM_FEATURES = [
  { id: 'voice', name: 'Lời nhắn giọng nói', used: (d) => d.voice === true },
  { id: 'together', name: 'Mở cùng nhau', used: (d) => d.together === true },
  { id: 'reactionCam', name: 'Quay phản ứng', used: (d) => d.reactionCam === true },
  { id: 'customMusic', name: 'Nhạc của bạn', used: (d) => d.music === CUSTOM_MUSIC_ID },
];

/** Tên các tính năng cao cấp thiệp đang dùng (rỗng = gói nào cũng được). */
export const premiumUsed = (data) => PREMIUM_FEATURES.filter((f) => f.used(data || {})).map((f) => f.name);

/** Gói có cho dùng các tính năng đó không; trả về câu báo lỗi hoặc null. */
export function premiumBlock(plan, data) {
  const used = premiumUsed(data);
  if (plan.extras || !used.length) return null;
  return `${used.join(', ')} chỉ có ở gói Đặc biệt. Bạn chọn gói Đặc biệt (hoặc tắt tính năng này) nhé.`;
}

/**
 * NÂNG CẤP SAU KHI GỬI: thiệp gói Cơ bản đang hoạt động trả thêm phần chênh lệch để lên gói Đặc biệt
 * (link dùng 365 ngày tính từ lúc nâng cấp, sửa lời được). Đơn nâng cấp có plan = 'nang-cap'.
 */
export const UPGRADE = { id: 'nang-cap', name: 'Nâng cấp lên Đặc biệt', from: 'co-ban', to: 'dac-biet' };
export const upgradePrice = () => PLANS[UPGRADE.to].price - PLANS[UPGRADE.from].price;

/** Tên gói để hiển thị (kể cả đơn nâng cấp). */
export const planName = (id) => PLANS[id]?.name || (id === UPGRADE.id ? UPGRADE.name : id);

/** Gói của các thiệp tạo bằng mã combo (thiệp thứ 2, 3…). */
export const COMBO_CARD_PLAN = 'dac-biet';

/**
 * GIÁ RA MẮT (đang tắt). Muốn bật: đặt `until` là ngày kết thúc (ví dụ '2026-10-20') và thêm `listPrice`
 * (giá sau đợt ra mắt) vào gói nào muốn hiện giá gạch. Chỉ bật khi thật sự sẽ tăng giá sau ngày đó.
 */
export const PROMO = { label: 'Giá ra mắt', until: null };

/** Giá gạch đang hiện của một gói (null = không hiện). Hết hạn là tự tắt. */
export function activeListPrice(plan, now = Date.now()) {
  if (!PROMO.until || !plan.listPrice || plan.listPrice <= plan.price) return null;
  return now <= new Date(`${PROMO.until}T23:59:59+07:00`).getTime() ? plan.listPrice : null;
}

/**
 * CAM KẾT HOÀN TIỀN: không ưng trong `hours` giờ sau khi thanh toán → hoàn 100%, thiệp bị gỡ.
 * Xử lý tay: khách nhắn Zalo kèm mã đơn → tìm ở /admin, bấm "Gỡ thiệp" → chuyển khoản trả lại.
 * Muốn tắt: đặt hours: 0 (trang chủ, trang thanh toán, trang quản lý tự ẩn dòng cam kết).
 * Combo không áp dụng vì mã combo có thể đã dùng cho thiệp khác.
 */
export const GUARANTEE = { hours: 24, plans: ['co-ban', 'dac-biet'] };

export const hasGuarantee = (planId) => GUARANTEE.hours > 0 && GUARANTEE.plans.includes(planId);

/** Còn trong thời gian được hoàn tiền không. */
export const withinGuarantee = (planId, paidAt, now = Date.now()) =>
  hasGuarantee(planId) && !!paidAt && now - paidAt < GUARANTEE.hours * 60 * 60 * 1000;

/** Số ảnh tối đa khi xem thử (chưa trả tiền). */
export const PREVIEW_MAX_IMAGES = 10;

export function formatVnd(amount) {
  return amount.toLocaleString('vi-VN') + 'đ';
}
