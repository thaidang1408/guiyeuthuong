import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateCardData } from '../functions/_lib/domain/card-data.ts';
import { AppError } from '../functions/_lib/domain/errors.ts';
import { ORDER_ALPHABET, ORDER_CODE_PATTERN, SLUG_PATTERN, newOrderCode, newSlug } from '../functions/_lib/domain/ids.ts';
import { detectImageMime, validateImages } from '../functions/_lib/domain/images.ts';
import { extractOrderCode } from '../functions/_lib/domain/order-code.ts';
import { computeExpiry, getPlan, isExpired } from '../functions/_lib/domain/plans.ts';
import { findBadWord } from '../functions/_lib/domain/profanity.ts';

const DAY = 24 * 60 * 60 * 1000;
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

describe('tìm mã đơn trong nội dung chuyển khoản', () => {
  it('tìm thấy mã nằm giữa nội dung', () => {
    assert.equal(extractOrderCode('NGUYEN VAN A chuyen tien TXAB23 cam on'), 'TXAB23');
  });
  it('chấp nhận chữ thường và trả về chữ hoa', () => {
    assert.equal(extractOrderCode('txab23'), 'TXAB23');
  });
  it('tìm mã dính liền ký tự khác do ngân hàng chèn thêm', () => {
    assert.equal(extractOrderCode('MBVCB.123456.TXQW9K.CT tu 0123'), 'TXQW9K');
  });
  it('ưu tiên trường code, rồi tới content', () => {
    assert.equal(extractOrderCode(null, 'ck TXZZ22'), 'TXZZ22');
    assert.equal(extractOrderCode('TXAA22', 'TXBB33'), 'TXAA22');
  });
  it('không có mã thì trả null', () => {
    assert.equal(extractOrderCode('chuyen tien an trua', undefined), null);
    assert.equal(extractOrderCode('TX12'), null);
  });
  it('mã sinh ra luôn tìm lại được', () => {
    for (let i = 0; i < 200; i++) {
      const code = newOrderCode();
      assert.match(code, ORDER_CODE_PATTERN);
      assert.equal(extractOrderCode(`ung ho ${code.toLowerCase()} nhe`), code);
    }
  });
});

describe('mã ngẫu nhiên', () => {
  it('bảng chữ mã đơn không có ký tự dễ nhầm', () => {
    for (const ch of '01IO') assert.ok(!ORDER_ALPHABET.includes(ch));
  });
  it('slug 8 ký tự hợp lệ', () => {
    const slugs = new Set(Array.from({ length: 500 }, newSlug));
    for (const s of slugs) assert.match(s, SLUG_PATTERN);
    assert.equal(slugs.size, 500);
  });
});

describe('ngày hết hạn', () => {
  const paidAt = Date.UTC(2026, 9, 15, 10, 0, 0);
  it('gói Cơ bản: 30 ngày', () => {
    assert.equal(computeExpiry(getPlan('co-ban'), paidAt), paidAt + 30 * DAY);
  });
  it('gói Đặc biệt: 365 ngày', () => {
    assert.equal(computeExpiry(getPlan('dac-biet'), paidAt), paidAt + 365 * DAY);
  });
  it('đúng thời điểm hết hạn thì coi là đã hết', () => {
    const exp = computeExpiry(getPlan('co-ban'), paidAt);
    assert.equal(isExpired(exp, exp - 1), false);
    assert.equal(isExpired(exp, exp), true);
    assert.equal(isExpired(null, exp), false);
  });
  it('gói lạ bị từ chối', () => {
    assert.throws(() => getPlan('mien-phi'), AppError);
    assert.throws(() => getPlan('__proto__'), AppError);
  });
});

describe('kiểm tra ảnh', () => {
  it('nhận diện loại ảnh theo byte đầu file', () => {
    assert.equal(detectImageMime(JPEG), 'image/jpeg');
    assert.equal(detectImageMime(PNG), 'image/png');
    assert.equal(detectImageMime(WEBP), 'image/webp');
    assert.equal(detectImageMime(new TextEncoder().encode('<svg onload=alert(1)>')), null);
  });
  it('giới hạn số ảnh theo gói', () => {
    assert.equal(validateImages([JPEG, PNG, WEBP], getPlan('co-ban')).length, 3);
    assert.throws(() => validateImages([JPEG, JPEG, JPEG, JPEG], getPlan('co-ban')), /tối đa 3 ảnh/);
  });
  it('chặn ảnh quá 350KB', () => {
    const big = new Uint8Array(350 * 1024 + 1);
    big.set(JPEG);
    assert.throws(() => validateImages([big], getPlan('dac-biet')), /quá nặng/);
  });
});

describe('lọc từ thô tục', () => {
  it('bắt từ thô tục nguyên từ', () => {
    assert.equal(findBadWord('Đồ ĐM nhé'), 'đm');
    assert.equal(findBadWord('vãi cả vcl luôn'), 'vcl');
    assert.equal(findBadWord('mày là đồ chó'), 'đồ chó');
  });
  it('không bắt nhầm từ bình thường', () => {
    assert.equal(findBadWord('Chúc mẹ luôn khỏe, con thương mẹ lớn lắm'), null);
    assert.equal(findBadWord('Lon nước ngọt, con chó nhà tớ dễ thương'), null);
    assert.equal(findBadWord('đi chơi đi mà, học cùng lớp'), null);
  });
});

describe('kiểm tra dữ liệu thiệp', () => {
  const valid = { recipientName: '  Linh ', senderName: 'Minh', relationship: 'crush', music: 'nhac-1', texts: { question: 'Đi chơi không?' } };

  it('chuẩn hóa và điền chữ mặc định cho ô trống', () => {
    const d = validateCardData('to-tinh', valid);
    assert.equal(d.recipientName, 'Linh');
    assert.equal(d.texts.question, 'Đi chơi không?');
    assert.equal(d.texts.yesText, 'Có 💖');
  });
  it('bỏ trường lạ, giữ nguyên chữ có ký tự HTML (hiển thị bằng textContent)', () => {
    const d = validateCardData('to-tinh', { ...valid, evil: 1, texts: { message: '<img src=x onerror=alert(1)>', hack: 'x' } });
    assert.equal('evil' in d, false);
    assert.equal('hack' in d.texts, false);
    assert.equal(d.texts.message, '<img src=x onerror=alert(1)>');
  });
  it('quan hệ/nhạc không hợp lệ thì dùng mặc định', () => {
    const d = validateCardData('to-tinh', { ...valid, relationship: 'me', music: '../../etc' });
    assert.equal(d.relationship, 'crush');
    assert.equal(d.music, 'nhac-2');
  });
  it('báo lỗi khi thiếu tên, chữ quá dài, có từ thô tục, mẫu không tồn tại', () => {
    assert.throws(() => validateCardData('to-tinh', { ...valid, senderName: ' ' }), /chưa điền/);
    assert.throws(() => validateCardData('to-tinh', { ...valid, texts: { message: 'a'.repeat(1001) } }), /dài quá/);
    assert.throws(() => validateCardData('to-tinh', { ...valid, texts: { message: 'đéo thích' } }), /chưa phù hợp/);
    assert.throws(() => validateCardData('khong-co', valid), /không tồn tại/);
  });
});
