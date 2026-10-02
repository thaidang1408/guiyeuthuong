// Sinh mã ngẫu nhiên an toàn (dùng crypto, không lệch phân phối).

export const ORDER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const SLUG_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export function randomString(length: number, alphabet: string): string {
  // Loại bỏ byte vượt bội số của độ dài bảng chữ để tránh lệch xác suất.
  const limit = 256 - (256 % alphabet.length);
  let out = '';
  while (out.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const b of bytes) {
      if (b < limit) out += alphabet[b % alphabet.length];
      if (out.length === length) break;
    }
  }
  return out;
}

export const newSlug = () => randomString(8, SLUG_ALPHABET);
export const newOrderCode = () => 'TX' + randomString(4, ORDER_ALPHABET);

export const SLUG_PATTERN = /^[a-z2-9]{8}$/;
export const ORDER_CODE_PATTERN = /^TX[A-Z2-9]{4}$/;

/** Mã sửa thiệp: 32 ký tự base64url, chỉ người tạo giữ. */
export function newEditToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
