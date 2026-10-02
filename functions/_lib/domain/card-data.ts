import { COMMON_FIELDS, MUSIC, RELATIONSHIP_LABEL_MAX, TEMPLATES, relationshipsOf, textDefault } from '../../../public/js/shared/templates.js';
import { CUSTOM_MUSIC_ID } from '../../../public/js/shared/audio.js';
import { LOCK_LIMITS } from '../../../public/js/shared/lock.js';
import { FX_PHRASE_MAX, pickFxIds } from '../../../public/js/shared/effects.js';
import { GAMES, GAME_LIMITS } from '../../../public/js/shared/games.js';
import { pickPronoun } from '../../../public/js/shared/pronouns.js';
import { pickFont } from '../../../public/js/shared/fonts.js';
import { openAtMs } from '../../../public/js/shared/schedule.js';
import { badRequest } from './errors.ts';
import { findBadWord } from './profanity.ts';

export type Pronoun = string | { toi: string; ban: string };

export interface CardData {
  recipientName: string;
  senderName: string;
  relationship: string;
  /** Cách xưng hô (xem public/js/shared/pronouns.js), ví dụ 'anh-em', hoặc tự nhập { toi, ban }. */
  pronoun: Pronoun;
  /** Mối quan hệ tự gõ khi chọn "Khác", ví dụ "Bà ngoại". */
  relationshipLabel?: string;
  music: string;
  /** Kiểu chữ (xem public/js/shared/fonts.js); '' = mặc định "Mềm mại". */
  font?: string;
  texts: Record<string, string>;
  /** Khóa câu hỏi bí mật (không bắt buộc): người nhận trả lời đúng mới mở được thiệp. */
  lock?: CardLock | null;
  /** Hiệu ứng mở đầu / màn kết đặc biệt (xem public/js/shared/effects.js). */
  fx?: CardFx;
  game?: CardGame;
  /** Hẹn giờ mở "YYYY-MM-DDTHH:mm" (giờ VN); '' = mở ngay. Trước giờ này server không gửi nội dung xuống. */
  openAt?: string;
  /** "Mở cùng nhau": chỉ mở khi cả người gửi lẫn người nhận cùng bấm sẵn sàng. */
  together?: boolean;
  /** Xin quay phản ứng của người nhận (người nhận vẫn phải tự đồng ý). */
  reactionCam?: boolean;
  /** Có lời nhắn giọng nói (server tự đặt theo file tải lên). */
  voice?: boolean;
}

export interface CardFx {
  opening: string;
  finale: string;
  bg: string;
  phrase: string;
}

export interface QuizQuestion {
  q: string;
  options: string[];
  answer: number;
}

/** Trò chơi cuối thiệp (xem public/js/shared/games.js). Chỉ giữ dữ liệu của trò được chọn. */
export interface CardGame {
  id: string;
  prizes?: string[];
  quiz?: QuizQuestion[];
}

export interface CardLock {
  question: string;
  hint: string;
  /** SHA-256 của đáp án đã chuẩn hóa (xem public/js/shared/lock.js). Không lưu đáp án thật. */
  answerHash: string;
}

interface FieldDef {
  label: string;
  max: number;
  required?: boolean;
  default?: string;
  multiline?: boolean;
  /** "date": ngày dạng YYYY-MM-DD, để trống được. */
  type?: 'date';
}

const MUSIC_IDS = new Set([...MUSIC.map((m: { id: string }) => m.id), CUSTOM_MUSIC_ID]);

export function getReadyTemplate(templateId: unknown) {
  if (typeof templateId !== 'string' || !Object.hasOwn(TEMPLATES, templateId)) {
    throw badRequest('Mẫu thiệp không tồn tại.');
  }
  const tpl = TEMPLATES[templateId as keyof typeof TEMPLATES];
  if (!tpl.ready) throw badRequest('Mẫu thiệp này sắp ra mắt, bạn chọn mẫu khác nhé.');
  return tpl;
}

/** Ô ngày: trống hoặc ngày thật dạng YYYY-MM-DD trong khoảng 1950–2099. */
function cleanDate(value: unknown, field: FieldDef): string {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  const valid = m && Number(m[1]) >= 1950 && Number(m[1]) <= 2099 && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toISOString().slice(0, 10) === s;
  if (!valid) throw badRequest(`"${field.label}" không phải ngày hợp lệ.`);
  return s;
}

/** Khóa câu hỏi: thiếu câu hỏi hoặc bản băm đáp án thì coi như không khóa. */
function cleanLock(raw: unknown): CardLock | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Record<string, unknown>;
  const answerHash = typeof input.answerHash === 'string' ? input.answerHash : '';
  const question = cleanText(input.question, { label: 'Câu hỏi bí mật', max: LOCK_LIMITS.question });
  if (!question || !/^[0-9a-f]{64}$/.test(answerHash)) return null;
  return { question, hint: cleanText(input.hint, { label: 'Gợi ý', max: LOCK_LIMITS.hint }), answerHash };
}

/** Hiệu ứng: id lạ bị bỏ; câu trong màn kết kiểm tra như mọi ô chữ khác. */
function cleanFx(raw: unknown, isEffectCard: boolean): CardFx {
  const ids = pickFxIds(raw);
  // Thiệp hiệu ứng: bản thân thiệp đã là hiệu ứng toàn màn hình, không gắn thêm màn kết hay nền.
  if (isEffectCard) ids.finale = ids.bg = '';
  const phrase = cleanText(raw && typeof raw === 'object' ? (raw as Record<string, unknown>).phrase : '', {
    label: 'Câu trong màn kết',
    max: FX_PHRASE_MAX,
  });
  return { ...ids, phrase };
}

const GAME_IDS = new Set(GAMES.map((g: { id: string }) => g.id));

function cleanGame(raw: unknown): CardGame {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const id = typeof input.id === 'string' && GAME_IDS.has(input.id) ? input.id : '';
  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  const L = GAME_LIMITS;
  if (id === 'vong-quay') {
    const prizes = list(input.prizes)
      .slice(0, L.prizes)
      .map((p) => cleanText(p, { label: 'Phần quà', max: L.prize }))
      .filter(Boolean);
    if (prizes.length < L.minPrizes) throw badRequest(`Vòng quay cần ít nhất ${L.minPrizes} phần quà.`);
    return { id, prizes };
  }
  if (id === 'cau-do') {
    const quiz: QuizQuestion[] = [];
    for (const item of list(input.quiz).slice(0, L.questions)) {
      const x = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      const q = cleanText(x.q, { label: 'Câu hỏi', max: L.question });
      const rawOptions = list(x.options).slice(0, L.options);
      const answerRaw = Number.isInteger(x.answer) ? (x.answer as number) : 0;
      // Bỏ đáp án trống nhưng vẫn giữ đúng vị trí đáp án đúng.
      const options: string[] = [];
      let answer = -1;
      rawOptions.forEach((o, i) => {
        const t = cleanText(o, { label: 'Đáp án', max: L.option });
        if (!t) return;
        if (i === answerRaw) answer = options.length;
        options.push(t);
      });
      if (!q || options.length < L.minOptions) continue;
      quiz.push({ q, options, answer: answer < 0 ? 0 : answer });
    }
    if (!quiz.length) throw badRequest('Câu đố cần ít nhất 1 câu hỏi có 2 đáp án.');
    return { id, quiz };
  }
  return { id: '' };
}

/** Làm sạch một ô chữ: bỏ ký tự điều khiển, cắt khoảng trắng, kiểm tra độ dài và từ thô tục. */
function cleanText(value: unknown, field: FieldDef): string {
  let s = typeof value === 'string' ? value : '';
  // Giữ xuống dòng cho ô nhiều dòng, bỏ các ký tự điều khiển khác.
  s = s.normalize('NFC').replace(field.multiline ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, '');
  s = s.replace(/\n{3,}/g, '\n\n').trim();
  if (!s && field.default !== undefined) s = field.default;
  if (!s && field.required) throw badRequest(`Bạn chưa điền "${field.label}".`);
  if ([...s].length > field.max) throw badRequest(`"${field.label}" dài quá (tối đa ${field.max} ký tự).`);
  const bad = findBadWord(s);
  if (bad) throw badRequest(`"${field.label}" có từ chưa phù hợp ("${bad}"), bạn sửa lại giúp mình nhé.`);
  return s;
}

/**
 * Kiểm tra và chuẩn hóa dữ liệu thiệp gửi lên.
 * Chỉ giữ các trường mẫu thiệp có khai báo; trường lạ bị bỏ qua.
 */
export function validateCardData(templateId: string, raw: unknown): CardData {
  const tpl = getReadyTemplate(templateId);
  if (!raw || typeof raw !== 'object') throw badRequest('Dữ liệu thiệp không hợp lệ.');
  const input = raw as Record<string, unknown>;

  const relationship = typeof input.relationship === 'string' && (relationshipsOf(tpl) as string[]).includes(input.relationship)
    ? input.relationship
    : tpl.relationships[0];
  const pronoun = pickPronoun(tpl, relationship, input.pronoun) as Pronoun;
  if (typeof pronoun === 'object' && findBadWord(`${pronoun.toi} ${pronoun.ban}`)) throw badRequest('Cách xưng hô có từ chưa phù hợp, bạn sửa lại nhé.');
  const relationshipLabel = relationship === 'khac' ? cleanText(input.relationshipLabel, { label: 'Mối quan hệ', max: RELATIONSHIP_LABEL_MAX }) : '';
  const music = typeof input.music === 'string' && MUSIC_IDS.has(input.music) ? input.music : tpl.defaultMusic;

  const rawTexts = input.texts && typeof input.texts === 'object' ? (input.texts as Record<string, unknown>) : {};
  const texts: Record<string, string> = {};
  for (const [key, field] of Object.entries(tpl.texts as Record<string, FieldDef>)) {
    // Ô bỏ trống thì dùng chữ mặc định đúng giọng văn của mối quan hệ (ví dụ "mẹ" khác "đồng nghiệp").
    texts[key] =
      field.type === 'date'
        ? cleanDate(rawTexts[key], field)
        : cleanText(rawTexts[key], { ...field, default: textDefault(templateId, key, relationship, pronoun) });
  }

  return {
    lock: cleanLock(input.lock),
    fx: cleanFx(input.fx, 'effect' in tpl && !!tpl.effect),
    game: cleanGame(input.game),
    recipientName: cleanText(input.recipientName, COMMON_FIELDS.recipientName),
    senderName: cleanText(input.senderName, COMMON_FIELDS.senderName),
    relationship,
    ...(relationshipLabel && { relationshipLabel }),
    pronoun,
    music,
    font: pickFont(input.font),
    openAt: openAtMs(input.openAt) !== null ? (input.openAt as string) : '',
    together: input.together === true,
    reactionCam: input.reactionCam === true,
    voice: input.voice === true,
    texts,
  };
}
