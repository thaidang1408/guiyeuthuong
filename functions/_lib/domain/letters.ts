// Thư "Mở khi…": mỗi thư có thể hẹn ngày mới được mở (giờ Việt Nam).
import { startOfDayVietnam } from './time.ts';

export const LETTER_COUNT = 6;

/** Các ô nội dung thư chưa tới ngày mở (để server xóa trước khi gửi cho người nhận). */
export function lockedLetterKeys(template: string, texts: Record<string, string>, now: number): string[] {
  if (template !== 'mo-khi') return [];
  const today = startOfDayVietnam(now);
  const keys: string[] = [];
  for (let i = 1; i <= LETTER_COUNT; i++) {
    const date = texts[`l${i}Date`];
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
    if (!m) continue;
    // 0 giờ ngày đó theo giờ Việt Nam
    const unlockAt = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - 7 * 60 * 60 * 1000;
    if (unlockAt > today) keys.push(`l${i}Body`);
  }
  return keys;
}
