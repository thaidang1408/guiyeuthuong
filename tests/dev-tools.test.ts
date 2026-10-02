// Nút "Giả lập tiền về" chỉ được phép chạy ở máy.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type Env, devToolsEnabled } from '../functions/_lib/env.ts';
import { CardService } from '../functions/_lib/services/card-service.ts';
import { DevPaymentSimulator } from '../functions/_lib/services/dev-payment-simulator.ts';
import { PaymentService } from '../functions/_lib/services/payment-service.ts';
import { JPEG, MemoryDb, fakeClock } from './helpers/memory-db.ts';

const env = (vars: Partial<Env>) => vars as Env;

describe('khóa an toàn của công cụ thử nghiệm', () => {
  it('chỉ bật khi có cờ VÀ đang chạy ở máy', () => {
    assert.equal(devToolsEnabled(env({ DEV_SIMULATE_PAYMENT: '1', CF_PAGES_BRANCH: 'local' })), true);
    assert.equal(devToolsEnabled(env({ DEV_SIMULATE_PAYMENT: '1', CF_PAGES_BRANCH: 'main' })), false); // lỡ đặt cờ trên Cloudflare
    assert.equal(devToolsEnabled(env({ DEV_SIMULATE_PAYMENT: '1' })), false);
    assert.equal(devToolsEnabled(env({ DEV_SIMULATE_PAYMENT: '0', CF_PAGES_BRANCH: 'local' })), false);
    assert.equal(devToolsEnabled(env({ CF_PAGES_BRANCH: 'local' })), false);
  });
});

describe('giả lập tiền về', () => {
  async function setup() {
    const db = new MemoryDb();
    const clock = fakeClock();
    const cards = new CardService({ cards: db, orders: db, rateLimits: db, now: clock.now });
    const payments = new PaymentService({ payments: db, orders: db, now: clock.now, webhookKey: 'k' });
    const created = await cards.createCard(
      { templateId: 'to-tinh', planId: 'co-ban', data: { recipientName: 'A', senderName: 'B', texts: {} }, images: [JPEG] },
      'ip',
    );
    return { db, created, sim: new DevPaymentSimulator(db, payments) };
  }

  it('đủ tiền → đi qua đúng đường webhook và kích hoạt thiệp', async () => {
    const { db, created, sim } = await setup();
    assert.deepEqual(await sim.simulate(created.orderCode, 'du'), { amount: 15000, outcome: 'matched' });
    assert.equal(db.cards[0].status, 'active');
    assert.equal(db.payments[0].status, 'matched');
  });

  it('thiếu tiền → cần duyệt tay', async () => {
    const { db, created, sim } = await setup();
    assert.deepEqual(await sim.simulate(created.orderCode, 'thieu'), { amount: 10000, outcome: 'needs_review' });
    assert.equal(db.cards[0].status, 'draft');
  });

  it('mã đơn không tồn tại → lỗi', async () => {
    const { sim } = await setup();
    await assert.rejects(sim.simulate('TXZZZZ', 'du'), /Không tìm thấy đơn/);
  });
});
