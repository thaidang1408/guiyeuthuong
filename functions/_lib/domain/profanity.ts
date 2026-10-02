import { BAD_WORDS } from '../config.ts';

const normalize = (s: string) => s.normalize('NFC').toLowerCase();

const singleWords = new Set<string>();
const phrases: string[] = [];
for (const w of BAD_WORDS) {
  const n = normalize(w).trim();
  if (n.includes(' ')) phrases.push(n);
  else singleWords.add(n);
}

/**
 * Trả về từ thô tục đầu tiên tìm thấy, hoặc null.
 * So khớp nguyên từ (giữ nguyên dấu) để tránh bắt nhầm, ví dụ "lớn" không bị coi là "lồn".
 */
export function findBadWord(text: string): string | null {
  const words = normalize(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  for (const w of words) if (singleWords.has(w)) return w;
  const joined = ` ${words.join(' ')} `;
  for (const p of phrases) if (joined.includes(` ${p} `)) return p;
  return null;
}
