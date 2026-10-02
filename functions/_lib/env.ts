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
  /** Wrangler tự đặt "local" khi chạy ở máy (npx wrangler pages dev). */
  CF_PAGES_BRANCH?: string;
}

/**
 * Công cụ thử nghiệm (nút giả lập tiền về) chỉ bật khi CẢ HAI điều kiện đúng:
 * có cờ DEV_SIMULATE_PAYMENT=1 và đang chạy ở máy. Trên Cloudflare thật luôn tắt,
 * kể cả khi ai đó lỡ đặt cờ.
 */
export const devToolsEnabled = (env: Env) => env.DEV_SIMULATE_PAYMENT === '1' && env.CF_PAGES_BRANCH === 'local';
