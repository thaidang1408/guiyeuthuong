// Đối soát dự phòng qua API SePay.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BankTransaction, BankTransactionFeed } from '../functions/_lib/repositories/interfaces.ts';
import { CardService } from '../functions/_lib/services/card-service.ts';
import { PaymentService } from '../functions/_lib/services/payment-service.ts';
import { PaymentSyncService } from '../functions/_lib/services/payment-sync-service.ts';
import { JPEG, MemoryDb, fakeClock } from './helpers/memory-db.ts';

class FakeFeed implements BankTransactionFeed {
  items: BankTransaction[] = [];
  calls = 0;
  fail = false;
  async listRecent() {
    this.calls++;
    if (this.fail) throw new Error('mất mạng');
    return this.items;
  }
}

/** Giới hạn tần suất thật theo thời gian (MemoryDb.hit chỉ đếm, không có cửa sổ thời gian). */
function windowedLimiter(now: () => number) {
  const starts = new Map<string, { start: number; count: number }>();
  return {
    async hit(key: string, _n: number, windowMs: number) {
      const s = starts.get(key);
      if (!s || s.start <= now() - windowMs) {
        starts.set(key, { start: now(), count: 1 });
        return 1;
      }
      return ++s.count;
    },
  };
}

async function setup() {
  const db = new MemoryDb();
  const clock = fakeClock();
  const feed = new FakeFeed();
  const cards = new CardService({ cards: db, orders: db, rateLimits: db, now: clock.now });
  const payments = new PaymentService({ payments: db, orders: db, now: clock.now, webhookKey: 'k' });
  const sync = new PaymentSyncService({ feed, payments, rateLimits: windowedLimiter(clock.now), now: clock.now });
  const created = await cards.createCard(
    { templateId: 'to-tinh', planId: 'co-ban', data: { recipientName: 'A', senderName: 'B', texts: {} }, images: [JPEG] },
    'ip',
  );
  return { db, clock, feed, sync, payments, created };
}

const tx = (id: string, content: string, amountIn = 15000): BankTransaction => ({ id, amountIn, content, code: null, transactionDate: '2026-10-01 16:21:00' });

describe('đối soát qua API SePay', () => {
  it('thấy tiền về có mã đơn → kích hoạt thiệp (nội dung kiểu MBBank)', async () => {
    const { db, feed, sync, created } = await setup();
    feed.items = [tx('86086249', `O5CH7KM96IMG-${created.orderCode}`)];
    assert.equal(await sync.syncIfDue(), true);
    assert.equal(db.cards[0].status, 'active');
  });

  it('bỏ qua tiền cá nhân không có mã đơn và tiền ra', async () => {
    const { db, feed, sync } = await setup();
    feed.items = [tx('1', 'NGUYEN VAN A chuyen tien'), tx('2', 'TXABCD', 0)];
    assert.equal(await sync.syncIfDue(), false);
    assert.equal(db.payments.length, 0);
  });

  it('webhook đã nhận giao dịch đó rồi → đối soát không xử lý lại', async () => {
    const { db, clock, feed, sync, payments, created } = await setup();
    await payments.processTransaction({ id: '777', transferType: 'in', transferAmount: 15000, content: created.orderCode });
    feed.items = [tx('777', created.orderCode)];
    clock.tick(0);
    assert.equal(await sync.syncIfDue(), false);
    assert.equal(db.payments.length, 1);
  });

  it('chỉ hỏi SePay tối đa 1 lần mỗi 10 giây', async () => {
    const { clock, feed, sync } = await setup();
    await sync.syncIfDue();
    await sync.syncIfDue();
    await sync.syncIfDue();
    assert.equal(feed.calls, 1);
    clock.tick(10_000);
    await sync.syncIfDue();
    assert.equal(feed.calls, 2);
  });

  it('SePay lỗi → không làm hỏng trang thanh toán', async () => {
    const { feed, sync } = await setup();
    feed.fail = true;
    assert.equal(await sync.syncIfDue(), false);
  });

  it('chưa cấu hình API Access → tắt', async () => {
    const { db, payments } = await setup();
    const off = new PaymentSyncService({ feed: null, payments, rateLimits: db, now: Date.now });
    assert.equal(await off.syncIfDue(), false);
  });
});
