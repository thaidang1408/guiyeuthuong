import { ADMIN_COOKIE, ADMIN_SESSION_MS, readCookie } from '../domain/admin-session.ts';
import { AppError } from '../domain/errors.ts';

// Cookie chỉ gửi kèm các yêu cầu tới /api/admin, JavaScript không đọc được (HttpOnly),
// không đi theo link từ trang khác (SameSite=Strict).
const attrs = (request: Request) =>
  `Path=/api/admin; HttpOnly; SameSite=Strict${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;

export const sessionCookie = (request: Request, token: string) =>
  `${ADMIN_COOKIE}=${token}; Max-Age=${ADMIN_SESSION_MS / 1000}; ${attrs(request)}`;

export const clearSessionCookie = (request: Request) => `${ADMIN_COOKIE}=; Max-Age=0; ${attrs(request)}`;

export const readSession = (request: Request) => readCookie(request.headers.get('Cookie'), ADMIN_COOKIE);

/** Chặn yêu cầu ghi dữ liệu đến từ trang web khác (chống CSRF, thêm một lớp ngoài SameSite). */
export function assertSameOrigin(request: Request): void {
  if (request.method === 'GET') return;
  const origin = request.headers.get('Origin');
  const sameOrigin = !origin || origin === new URL(request.url).origin;
  const isJson = (request.headers.get('Content-Type') ?? '').startsWith('application/json');
  if (!sameOrigin || !isJson) throw new AppError(403, 'Yêu cầu không hợp lệ.');
}
