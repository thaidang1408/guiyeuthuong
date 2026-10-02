// Combo 20/10: trả 49k một lần, được 3 thiệp (thiệp mua + 2 thiệp dùng mã).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { comboCodeFromEditToken, formatComboCode, normalizeComboCode } from '../public/js/shared/combo.js';
import { CardService } from '../functions/_lib/services/card-service.ts';
import { DAY, JPEG, MemoryDb, fakeClock } from './helpers/memory-db.ts';

function setup() {
  const db = new MemoryDb();
  const clock = fakeClock();
  const service = new CardService({ cards: db, orders: db, rateLimits: db, now: clock.now });
  const create = (planId: string, comboCode: string | null = null, ip = 'ip') =>
    service.createCard(
      { templateId: 'phu-nu-2010', planId, comboCode, data: { recipientName: 'Mẹ', senderName: 'Con', relationship: 'me', texts: {} }, images: [JPEG] },
      ip,
    );
  return { db, clock, service, create };
}

/** Mua combo: tạo đơn gói combo, giả lập đã trả tiền, trả về mã combo người mua thấy. */
async function buyCombo(ctx: ReturnType<typeof setup>) {
  const res = await ctx.create('combo');
  assert.equal(res.amount, 49000);
  await ctx.db.markPaidAndActivate(res.orderCode, ctx.clock.now(), ctx.clock.now() + 365 * DAY);
  return { res, code: await comboCodeFromEditToken(res.editToken) };
}

describe('Mã combo', () => {
  it('tính cố định từ mã sửa, 10 ký tự dễ đọc; nhập kèm gạch, chữ thường vẫn nhận', async () => {
    const code = await comboCodeFromEditToken('abc123-token');
    assert.match(code, /^[A-HJ-NP-Z2-9]{10}$/);
    assert.equal(code, await comboCodeFromEditToken('abc123-token'));
    assert.notEqual(code, await comboCodeFromEditToken('abc123-tokem'));
    assert.equal(normalizeComboCode(` ${formatComboCode(code).toLowerCase()} `), code);
  });

  it('dùng được đúng 2 lần: thiệp kích hoạt ngay, gói Đặc biệt, 0đ', async () => {
    const ctx = setup();
    const { code } = await buyCombo(ctx);
    assert.deepEqual(await ctx.service.comboStatus(code, 'ip'), { total: 3, used: 1, remaining: 2, paid: true });

    for (let i = 0; i < 2; i++) {
      const r = await ctx.create('co-ban', formatComboCode(code).toLowerCase());
      assert.equal(r.paid, true);
      assert.equal(r.amount, 0);
      const card = await ctx.db.findBySlug(r.slug);
      assert.equal(card?.status, 'active');
      assert.equal(card?.plan, 'dac-biet');
      assert.equal(card?.expiresAt, ctx.clock.now() + 365 * DAY);
    }
    assert.equal((await ctx.service.comboStatus(code, 'ip')).remaining, 0);
    await assert.rejects(ctx.create('co-ban', code), /hết lượt/);
    // Thiệp tạo bằng combo không sinh ra combo mới.
    assert.equal((await ctx.db.revenueSince(0)).total, 49000);
  });

  it('combo chưa trả tiền, mã sai, mã của gói thường đều không dùng được', async () => {
    const ctx = setup();
    const unpaid = await ctx.create('combo');
    await assert.rejects(ctx.create('co-ban', await comboCodeFromEditToken(unpaid.editToken)), /chưa được thanh toán/);
    const normal = await ctx.create('dac-biet');
    await ctx.db.markPaidAndActivate(normal.orderCode, ctx.clock.now(), ctx.clock.now() + DAY);
    await assert.rejects(ctx.create('co-ban', await comboCodeFromEditToken(normal.editToken)), /không đúng/);
    await assert.rejects(ctx.create('co-ban', 'ABCDEFGHJK'), /không đúng/);
    await assert.rejects(ctx.create('co-ban', 'ngắn'), /10 ký tự/);
  });

  it('dữ liệu thiệp lỗi thì không mất lượt combo', async () => {
    const ctx = setup();
    const { code } = await buyCombo(ctx);
    await assert.rejects(
      ctx.service.createCard({ templateId: 'phu-nu-2010', planId: 'co-ban', comboCode: code, data: { recipientName: '', senderName: 'Con', texts: {} }, images: [] }, 'ip'),
      /chưa điền/,
    );
    assert.equal((await ctx.service.comboStatus(code, 'ip')).remaining, 2);
  });

  it('chặn dò mã: quá 10 lần nhập mỗi giờ', async () => {
    const ctx = setup();
    for (let i = 0; i < 10; i++) await ctx.create('co-ban', 'ABCDEFGHJK', 'ke-xau').catch(() => {});
    await assert.rejects(ctx.create('co-ban', 'ABCDEFGHJK', 'ke-xau'), /nhiều/);
  });
});
