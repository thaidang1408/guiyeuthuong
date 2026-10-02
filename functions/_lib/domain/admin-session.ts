// Phiên đăng nhập trang quản trị, không cần lưu gì trên server (không tốn KV/D1):
// cookie = "<hạn dùng>.<chữ ký>", chữ ký là HMAC-SHA256 tạo từ mật khẩu quản trị.
// Đổi mật khẩu là mọi phiên cũ mất hiệu lực ngay.
import { safeEqual } from './security.ts';

export const ADMIN_COOKIE = 'gyt_admin';
export const ADMIN_SESSION_MS = 12 * 60 * 60 * 1000;

async function sign(password: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode('gyt-admin-v1:' + password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
  return [...sig].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createSessionToken(password: string, now: number): Promise<string> {
  const exp = String(now + ADMIN_SESSION_MS);
  return `${exp}.${await sign(password, exp)}`;
}

export async function verifySessionToken(password: string, token: string | null | undefined, now: number): Promise<boolean> {
  if (!token) return false;
  const m = /^(\d{10,16})\.([0-9a-f]{64})$/.exec(token);
  if (!m || Number(m[1]) < now) return false;
  return safeEqual(await sign(password, m[1]), m[2]);
}

/** Đọc một cookie trong header Cookie. */
export function readCookie(header: string | null, name: string): string | null {
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

export { startOfDayVietnam } from './time.ts';
