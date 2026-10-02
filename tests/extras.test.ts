// Tính năng "tiên phong": hẹn giờ mở, lời nhắn giọng nói, mở cùng nhau, quay phản ứng, sổ tình yêu chung.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { openAtMs, toOpenAt } from '../public/js/shared/schedule.js';
import { validateCardData } from '../functions/_lib/domain/card-data.ts';
import { CardService } from '../functions/_lib/services/card-service.ts';
import { ExtrasService } from '../functions/_lib/services/extras-service.ts';
import { ManageService } from '../functions/_lib/services/manage-service.ts';
import { OrderService } from '../functions/_lib/services/order-service.ts';
import { DAY, JPEG, MemoryDb, fakeClock } from './helpers/memory-db.ts';

const NOW = Date.UTC(2026, 9, 10, 3); // 10:00 ngày 10/10/2026 giờ VN

function setup() {
  const db = new MemoryDb();
  const clock = fakeClock(NOW);
  const cardService = new CardService({ cards: db, orders: db, rateLimits: db, now: clock.now, signatures: db.signatureRepo });
  const create = async (templateId: string, extra: Record<string, unknown> = {}, more: Record<string, unknown> = {}) => {
    const res = await cardService.createCard(
      { templateId, planId: 'dac-biet', data: { recipientName: 'Linh', senderName: 'Minh', texts: {}, ...extra }, images: [JPEG], ...more },
      'ip',
    );
    await db.markPaidAndActivate(res.orderCode, clock.now(), clock.now() + 365 * DAY);
    return res;
  };
  return { db, clock, cardService, create };
}

describe('Hẹn giờ mở thiệp', () => {
  it('đổi giờ VN ↔ mili-giây, từ chối ngày giờ sai', () => {
    assert.equal(openAtMs('2026-10-20T00:00'), Date.UTC(2026, 9, 19, 17));
    assert.equal(toOpenAt(Date.UTC(2026, 9, 19, 17)), '2026-10-20T00:00');
    for (const bad of ['2026-02-30T00:00', '2026-10-20 00:00', '2026-10-20T24:00', '1999-01-01T00:00', '', null]) assert.equal(openAtMs(bad), null, String(bad));
  });

  it('server chỉ giữ giờ hợp lệ', () => {
    const base = { recipientName: 'Linh', senderName: 'Minh', texts: {} };
    assert.equal(validateCardData('to-tinh', { ...base, openAt: '2026-10-20T00:00' }).openAt, '2026-10-20T00:00');
    assert.equal(validateCardData('to-tinh', { ...base, openAt: 'mai nhé' }).openAt, '');
  });

  it('chưa tới giờ: không gửi nội dung, không cho xem ảnh, không tính là đã mở; tới giờ thì mở bình thường', async () => {
    const { db, clock, cardService, create } = setup();
    const res = await create('to-tinh', { openAt: '2026-10-10T12:00', texts: { message: 'Bí mật nè' } });
    const early = await cardService.openForViewer(res.slug);
    assert.ok(early?.waitUntil);
    assert.equal(early.waitUntil, openAtMs('2026-10-10T12:00'));
    assert.equal(early.serverNow, NOW);
    assert.deepEqual(early.data.texts, {});
    assert.equal(early.imageCount, 0);
    assert.equal(await cardService.getImage(res.slug, 0, null), null);
    assert.equal(db.cards[0].views, 0);
    assert.equal(db.cards[0].firstOpenedAt, null);

    clock.tick(2 * 60 * 60 * 1000); // 12:00
    const open = await cardService.openForViewer(res.slug);
    assert.equal(open?.waitUntil, undefined);
    assert.equal(open?.data.texts.message, 'Bí mật nè');
    assert.ok(await cardService.getImage(res.slug, 0, null));
    assert.equal(db.cards[0].views, 1);
  });
});

// ---------- Giọng nói, mở cùng nhau, video phản ứng, sổ tình yêu ----------

const WEBM = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3]);
const MP4 = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 1, 2]);

function setupExtras() {
  const base = setup();
  const extras = new ExtrasService({ cardService: base.cardService, cards: base.db, extras: base.db, rateLimits: base.db, now: base.clock.now });
  const manage = new ManageService({ cards: base.db, orders: base.db, now: base.clock.now, extras });
  return { ...base, extras, manage };
}

describe('Lời nhắn giọng nói', () => {
  it('giọng nói, mở cùng nhau, quay phản ứng chỉ có ở gói Đặc biệt / Combo', async () => {
    const { create } = setup();
    await assert.rejects(create('to-tinh', {}, { voice: WEBM, planId: 'co-ban' }), /Lời nhắn giọng nói chỉ có ở gói Đặc biệt/);
    await assert.rejects(create('to-tinh', { together: true, reactionCam: true }, { planId: 'co-ban' }), /Mở cùng nhau, Quay phản ứng/);
    const ok = await create('to-tinh', { openAt: '' }, { planId: 'co-ban' });
    assert.ok(ok.slug);
    // Đã chọn Đặc biệt (chưa trả) rồi đổi xuống Cơ bản ở trang thanh toán: bị chặn; lên Combo thì được.
    const { db, clock, cardService } = setup();
    const orderService = new OrderService({ cards: db, orders: db, now: clock.now, account: null });
    const res = await cardService.createCard(
      { templateId: 'to-tinh', planId: 'dac-biet', data: { recipientName: 'Linh', senderName: 'Minh', texts: {}, together: true }, images: [JPEG] },
      'ip2',
    );
    await assert.rejects(orderService.changePlan(res.orderCode, 'co-ban', res.slug, res.editToken), /Mở cùng nhau chỉ có ở gói Đặc biệt/);
    assert.equal((await orderService.changePlan(res.orderCode, 'combo', res.slug, res.editToken)).plan, 'combo');
  });

  it('lưu file ghi âm hợp lệ, bật cờ voice; file lạ bị từ chối; cờ voice không tự bật khi không có file', async () => {
    const { create, extras } = setupExtras();
    const res = await create('to-tinh', {}, { voice: WEBM });
    const voice = await extras.getVoice(res.slug);
    assert.equal(voice?.mime, 'audio/webm');
    const noVoice = await create('to-tinh', { voice: true });
    assert.equal(await extras.getVoice(noVoice.slug), null);
    await assert.rejects(create('to-tinh', {}, { voice: new Uint8Array(20) }), /không đúng định dạng/);
  });
});

describe('Mở cùng nhau', () => {
  it('chỉ khi cả hai cùng sẵn sàng mới có mốc cùng mở; người tạo phải có mã sửa', async () => {
    const { clock, create, extras } = setupExtras();
    const res = await create('chuyen-tinh', { together: true });
    let s = await extras.together(res.slug, 'nhan', null, 'a');
    assert.deepEqual([s.otherReady, s.startAt], [false, null]);
    await assert.rejects(extras.together(res.slug, 'gui', 'sai-ma-sua-nay-dai-du-16', 'b'), /không đúng/);
    clock.tick(1000);
    s = await extras.together(res.slug, 'gui', res.editToken, 'b');
    assert.equal(s.otherReady, true);
    assert.equal(s.startAt, clock.now() + 4000);
    const start = s.startAt;
    clock.tick(1500);
    s = await extras.together(res.slug, 'nhan', null, 'a');
    assert.equal(s.startAt, start); // cả hai thấy CÙNG một mốc
    // Bên kia im lặng quá lâu thì coi như chưa sẵn sàng.
    clock.tick(120_000);
    s = await extras.together(res.slug, 'nhan', null, 'a');
    assert.deepEqual([s.otherReady, s.startAt], [false, null]);
    const plain = await create('to-tinh');
    await assert.rejects(extras.together(plain.slug, 'nhan', null, 'a'), /không bật/);
  });
});

describe('Video phản ứng', () => {
  it('chỉ nhận khi người tạo có xin; một video mỗi thiệp; chỉ người tạo xem được', async () => {
    const { create, extras, manage } = setupExtras();
    const res = await create('to-tinh', { reactionCam: true });
    await extras.uploadReaction(res.slug, MP4, 'a');
    await assert.rejects(extras.uploadReaction(res.slug, MP4, 'a'), /đã nhận video/);
    await assert.rejects(extras.getReaction(res.slug, 'khong-dung-ma-sua-123'), /không đúng/);
    assert.equal((await extras.getReaction(res.slug, res.editToken))?.mime, 'video/mp4');
    assert.ok((await manage.getView(res.slug, res.editToken)).reactionAt);
    const plain = await create('to-tinh');
    await assert.rejects(extras.uploadReaction(plain.slug, MP4, 'a'), /không xin quay/);
    await assert.rejects(extras.uploadReaction(res.slug, new Uint8Array(30), 'a'), /đã nhận|định dạng/);
  });
});

describe('Sổ tình yêu chung', () => {
  it('hai người viết thêm trang (chữ + ảnh), lọc từ thô tục, người tạo xóa được', async () => {
    const { create, extras, manage } = setupExtras();
    const res = await create('so-tay');
    let list = await extras.addMemory(res.slug, { author: 'nhan', text: '  Hôm nay đi Đà Lạt vui ghê  ', image: JPEG }, 'a');
    list = await extras.addMemory(res.slug, { author: 'gui', text: 'Nhớ em', image: null }, 'b');
    assert.deepEqual(list.map((m) => [m.author, m.text, m.hasImage]), [['nhan', 'Hôm nay đi Đà Lạt vui ghê', true], ['gui', 'Nhớ em', false]]);
    assert.ok(await extras.getMemoryImage(res.slug, list[0].id));
    await assert.rejects(extras.addMemory(res.slug, { author: 'nhan', text: '   ', image: null }, 'a'), /viết vài dòng/);
    await assert.rejects(extras.addMemory(res.slug, { author: 'nhan', text: 'x'.repeat(401), image: null }, 'a'), /tối đa/);
    await assert.rejects(extras.addMemory(res.slug, { author: 'nhan', text: 'ok', image: new Uint8Array(10) }, 'a'), /JPG/);
    assert.equal((await manage.getView(res.slug, res.editToken)).memories?.length, 2);
    await extras.deleteMemory(res.slug, res.editToken, list[1].id);
    assert.equal((await extras.listMemories(res.slug)).length, 1);
    const plain = await create('to-tinh');
    await assert.rejects(extras.addMemory(plain.slug, { author: 'nhan', text: 'hi', image: null }, 'a'), /không phải sổ/);
  });
});
