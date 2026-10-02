import { parseRange } from '../domain/audio.ts';
import { AppError } from '../domain/errors.ts';

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

/** Đổi lỗi thành phản hồi JSON. Lỗi lạ chỉ ghi log, không lộ chi tiết cho người dùng. */
export function errorResponse(e: unknown): Response {
  if (e instanceof AppError) return json({ error: e.message }, e.status);
  console.error(e);
  return json({ error: 'Có lỗi xảy ra, bạn thử lại sau nhé.' }, 500);
}

// Các ký tự cần thoát khi nhúng JSON vào HTML: < > & và hai ký tự xuống dòng Unicode (U+2028, U+2029).
const UNSAFE_IN_SCRIPT = new RegExp('[<>&' + String.fromCharCode(0x2028, 0x2029) + ']', 'g');
const toUnicodeEscape = (ch: string) => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0');

/**
 * Chuyển dữ liệu thành JSON an toàn để nhúng trong thẻ <script type="application/json">:
 * thoát các ký tự có thể đóng thẻ script hoặc phá HTML.
 */
export function jsonForHtml(data: unknown): string {
  return JSON.stringify(data).replace(UNSAFE_IN_SCRIPT, toUnicodeEscape);
}

/** Trả file âm thanh/video, hỗ trợ "Range" (Safari trên iPhone chỉ phát được khi server trả từng đoạn). */
export function mediaResponse(request: Request, media: { mime: string; data: Uint8Array }, cache: string): Response {
  const size = media.data.length;
  const headers: Record<string, string> = {
    'Content-Type': media.mime,
    'Accept-Ranges': 'bytes',
    'Cache-Control': cache,
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex',
  };
  const range = parseRange(request.headers.get('Range'), size);
  if (range === 'invalid') return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } });
  if (!range) return new Response(media.data, { headers: { ...headers, 'Content-Length': String(size) } });
  return new Response(media.data.subarray(range.start, range.end + 1), {
    status: 206,
    headers: { ...headers, 'Content-Range': `bytes ${range.start}-${range.end}/${size}`, 'Content-Length': String(range.end - range.start + 1) },
  });
}

/** CSP chặt cho trang thiệp: chỉ chạy script của chính trang, không script nội tuyến. */
export const CARD_PAGE_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  "img-src 'self' blob: data:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');
