// ĐỊA CHỈ CHÍNH THỨC của web. Sau này mua tên miền riêng thì đổi ở đây.
export const SITE_HOST = 'guiyeuthuong.pages.dev';

/**
 * Mỗi lần deploy, Cloudflare tạo thêm địa chỉ riêng cho bản đó, ví dụ "095f7b5a.guiyeuthuong.pages.dev"
 * (hoặc "main.guiyeuthuong.pages.dev"). Địa chỉ đó trông kém tin cậy và CHẠY MÃI BẢN CŨ — thiệp tạo từ
 * đó cũng mang link cũ. Trả về địa chỉ chính thức tương ứng, hoặc null nếu đang ở đúng địa chỉ.
 */
export function canonicalUrl(href) {
  const url = new URL(href);
  if (!url.hostname.endsWith(`.${SITE_HOST}`)) return null;
  url.hostname = SITE_HOST;
  return url.href;
}
