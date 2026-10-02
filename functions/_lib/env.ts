/** Các biến môi trường và tài nguyên Cloudflare mà app dùng. */
export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  SEPAY_WEBHOOK_KEY?: string;
  SEPAY_ACC?: string;
  SEPAY_BANK?: string;
  /** API Access của SePay (không bắt buộc): dùng để tự đối soát khi webhook không tới. */
  SEPAY_API_TOKEN?: string;
  ADMIN_PASSWORD?: string;
  SUPPORT_ZALO?: string;
  /** "1" để hiện nút "Giả lập tiền về" trên trang thanh toán. Chỉ có tác dụng khi chạy ở máy. */
  DEV_SIMULATE_PAYMENT?: string;
  /** Wrangler đặt "local" khi chạy ở máy — nhưng nếu thư mục là kho git thì đặt theo tên nhánh (vd "main"). */
  CF_PAGES_BRANCH?: string;
}

/**
 * Địa chỉ chỉ có khi chạy ở máy: localhost, 127.x, hoặc IP mạng nhà (thử bằng điện thoại cùng Wi-Fi).
 * Cloudflare chỉ chuyển tới web những yêu cầu mang tên miền thật, nên trên mạng không bao giờ gặp các địa chỉ này.
 */
export function isLocalHost(request: Request | null | undefined): boolean {
  if (!request) return false;
  const host = new URL(request.url).hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host === '::1') return true;
  // Chỉ nhận địa chỉ IP đầy đủ (chặn tên miền giả kiểu "127.0.0.1.evil.com").
  const ip = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!ip) return false;
  const [a, b] = [Number(ip[1]), Number(ip[2])];
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

/** Đang chạy ở máy (wrangler pages dev), không phải trên Cloudflare. */
export const isLocalRun = (env: Env, request?: Request | null) => env.CF_PAGES_BRANCH === 'local' || isLocalHost(request);

/**
 * Công cụ thử nghiệm (nút giả lập tiền về) chỉ bật khi CẢ HAI điều kiện đúng:
 * có cờ DEV_SIMULATE_PAYMENT=1 và đang chạy ở máy. Trên Cloudflare thật luôn tắt,
 * kể cả khi ai đó lỡ đặt cờ.
 */
export const devToolsEnabled = (env: Env, request?: Request | null) => env.DEV_SIMULATE_PAYMENT === '1' && isLocalRun(env, request);
