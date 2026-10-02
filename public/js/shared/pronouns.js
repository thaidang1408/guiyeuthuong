// CÁCH XƯNG HÔ — để cả nam lẫn nữ đều dùng được (dùng chung cho trình duyệt và server).
// Chữ mặc định và lời chúc gợi ý viết bằng chỗ trống: {toi}/{Toi} = người gửi tự xưng, {ban}/{Ban} = gọi người nhận.
// Chữ hoa đầu ({Toi}, {Ban}) dùng ở đầu câu. Người tạo chọn cách xưng hô ở bước 1, chữ mặc định tự đổi theo.

export const PRONOUNS = {
  'to-cau': { label: 'Tớ – cậu', toi: 'tớ', ban: 'cậu' },
  'anh-em': { label: 'Anh – em', toi: 'anh', ban: 'em', hint: 'bạn là nam' },
  'em-anh': { label: 'Em – anh', toi: 'em', ban: 'anh', hint: 'bạn là nữ' },
  'tui-ba': { label: 'Tui – bà', toi: 'tui', ban: 'bà', hint: 'bạn thân là nữ' },
  'tui-ong': { label: 'Tui – ông', toi: 'tui', ban: 'ông', hint: 'bạn thân là nam' },
  // Các mối quan hệ chỉ có một cách xưng hô (không hiện lựa chọn):
  'con-me': { label: 'Con – mẹ', toi: 'con', ban: 'mẹ' },
  'em-co': { label: 'Em – cô', toi: 'em', ban: 'cô' },
  'em-chi': { label: 'Em – chị', toi: 'em', ban: 'chị' },
};

/** Các cách xưng hô cho từng mối quan hệ; cách đầu tiên là mặc định. */
export const RELATIONSHIP_PRONOUNS = {
  crush: ['to-cau', 'anh-em', 'em-anh'],
  'nguoi-yeu': ['to-cau', 'anh-em', 'em-anh'],
  vo: ['anh-em'],
  chong: ['em-anh'],
  'ban-than': ['to-cau', 'tui-ba', 'tui-ong'],
  me: ['con-me'],
  'co-giao': ['em-co'],
  'dong-nghiep': ['em-chi'],
  khac: ['to-cau', 'anh-em', 'em-anh'],
};

/** Xưng hô tự nhập: { toi, ban }, mỗi từ 1–12 chữ cái (có dấu), cho phép dấu cách. */
export const CUSTOM_PRONOUN_MAX = 12;
const WORD = /^[\p{L} ]+$/u;
function cleanCustom(p) {
  if (!p || typeof p !== 'object') return null;
  const w = (v) => (typeof v === 'string' ? v.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase() : '');
  const toi = w(p.toi);
  const ban = w(p.ban);
  const ok = (x) => x.length >= 1 && x.length <= CUSTOM_PRONOUN_MAX && WORD.test(x);
  return ok(toi) && ok(ban) ? { toi, ban } : null;
}
export const isCustomPronoun = (pronoun) => !!pronoun && typeof pronoun === 'object';

/** Cách xưng hô dùng được cho mối quan hệ (mẫu có thể giới hạn lại bằng tpl.pronouns[rel]). */
export function pronounOptions(tpl, relationship) {
  return tpl?.pronouns?.[relationship] || RELATIONSHIP_PRONOUNS[relationship] || ['to-cau'];
}

/** Cách xưng hô hợp lệ (sai hoặc thiếu thì lấy cách mặc định của mối quan hệ). Tự nhập thì là { toi, ban }. */
export function pickPronoun(tpl, relationship, pronoun) {
  const custom = cleanCustom(pronoun);
  if (custom) return custom;
  const options = pronounOptions(tpl, relationship);
  return options.includes(pronoun) ? pronoun : options[0];
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Thay {toi} {Toi} {ban} {Ban} trong một đoạn chữ. */
const wordsOf = (pronoun) => cleanCustom(pronoun) || PRONOUNS[pronoun] || PRONOUNS['to-cau'];

export function fillPronouns(text, pronoun) {
  const p = wordsOf(pronoun);
  return String(text)
    .replaceAll('{toi}', p.toi)
    .replaceAll('{Toi}', cap(p.toi))
    .replaceAll('{ban}', p.ban)
    .replaceAll('{Ban}', cap(p.ban));
}

/** Đối tượng { toi, ban, Toi, Ban } để mẫu thiệp ghép câu. */
export function pronounWords(pronoun) {
  const p = wordsOf(pronoun);
  return { toi: p.toi, ban: p.ban, Toi: cap(p.toi), Ban: cap(p.ban) };
}
