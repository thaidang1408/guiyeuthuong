// Câu trả lời của người nhận ở mẫu "Đi chơi với tớ không?": ngày rảnh, món muốn ăn, lời nhắn thêm.
import { badRequest } from './errors.ts';
import { findBadWord } from './profanity.ts';
import { DAY_MS, startOfDayVietnam } from './time.ts';

export interface DiChoiAnswer {
  /** Ngày dạng YYYY-MM-DD. */
  date: string;
  food: string;
  note: string;
}

export const ANSWER_LIMITS = { food: 40, note: 200, daysAhead: 366 };

function clean(value: unknown, label: string, max: number, required: boolean): string {
  const s = (typeof value === 'string' ? value : '').normalize('NFC').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s && required) throw badRequest(`Bạn chưa chọn ${label}.`);
  if ([...s].length > max) throw badRequest(`${label[0].toUpperCase()}${label.slice(1)} dài quá (tối đa ${max} ký tự).`);
  const bad = findBadWord(s);
  if (bad) throw badRequest(`Có từ chưa phù hợp ("${bad}"), bạn sửa lại giúp mình nhé.`);
  return s;
}

/** Kiểm tra câu trả lời. Ngày phải là ngày thật, từ hôm qua (lệch múi giờ) đến 1 năm tới. */
export function validateAnswer(raw: unknown, now: number): DiChoiAnswer {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const date = typeof input.date === 'string' ? input.date : '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw badRequest('Bạn chưa chọn ngày.');
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (new Date(ms).toISOString().slice(0, 10) !== date) throw badRequest('Ngày không hợp lệ.');
  const today = startOfDayVietnam(now);
  if (ms < today - 2 * DAY_MS || ms > today + ANSWER_LIMITS.daysAhead * DAY_MS) throw badRequest('Bạn chọn ngày trong vòng một năm tới nhé.');
  return {
    date,
    food: clean(input.food, 'món ăn', ANSWER_LIMITS.food, true),
    note: clean(input.note, 'lời nhắn', ANSWER_LIMITS.note, false),
  };
}
