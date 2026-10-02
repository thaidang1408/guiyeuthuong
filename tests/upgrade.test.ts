// Nâng cấp Cơ bản → Đặc biệt sau khi gửi.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { upgradePrice } from '../public/js/shared/plans.js';
import { CardService } from '../functions/_lib/services/card-service.ts';
import { ManageService } from '../functions/_lib/services/manage-service.ts';
import { OrderService } from '../functions/_lib/services/order-service.ts';
import { PaymentService } from '../functions/_lib/services/payment-service.ts';
import { DAY, JPEG, MemoryDb, fakeClock } from './helpers/memory-db.ts';

const KEY = 'khoa-bi-mat-123';
const sepay = (id: number, code: string, amount: number) => ({ id, code, content: code, transferType: 'in', transferAmount: amount });

function setup() {
  const db = new MemoryDb();
  const clock = fakeClock();
  const cardService = new CardService({ cards: db, orders: db, rateLimits: db, now: clock.now });
  const orderService = new OrderService({ cards: db, orders: db, now: clock.now, account: null, rateLimits: db });
  const payments = new PaymentService({ payments: db, orders: db, now: clock.now, webhookKey: KEY });
  const manage = new ManageService({ cards: db, orders: db, now: clock.now });
  const create = (planId: string) =>
    cardService.createCard({ templateId: 'to-tinh', planId, data: { recipientName: 'Linh', senderName: 'Minh', texts: {} }, images: [JPEG] }, 'ip');
  let txId = 1;
  const pay = (code: string, amount: number) => payments.handleWebhook(`Apikey ${KEY}`, sepay(txId++, code, amount));
  return { db, clock, orderService, manage, create, pay };
}

describe('Nâng cấp sau khi gửi', () => {
  it('Cơ bản đang hoạt động → đơn chênh lệch → tiền về thì thành Đặc biệt, link thêm 365 ngày', async () => {
    const { db, clock, orderService, manage, create, pay } = setup();
    const c = await create('co-ban');
    await pay(c.orderCode, 15000);
    clock.tick(5 * DAY);
    const up = await orderService.createUpgrade(c.slug, c.editToken, 'ip');
    assert.equal(up.plan, 'nang-cap');
    assert.equal(up.amount, upgradePrice());
    assert.equal(upgradePrice(), 14000);
    // Đơn nâng cấp không đổi gói được, không làm mất đơn mua ở trang quản lý.
    await assert.rejects(orderService.changePlan(up.code, 'combo', c.slug, c.editToken), /không đổi gói/);
    assert.equal((await manage.getView(c.slug, c.editToken)).paidOrder?.code, c.orderCode);

    assert.equal(await pay(up.code, 13000), 'needs_review'); // thiếu tiền
    assert.equal(db.cards[0].plan, 'co-ban');
    assert.equal(await pay(up.code, 14000), 'matched');
    const view = await manage.getView(c.slug, c.editToken);
    assert.equal(view.plan, 'dac-biet');
    assert.equal(view.canEdit, true);
    assert.equal(view.expiresAt, clock.now() + 365 * DAY);
    await assert.rejects(orderService.createUpgrade(c.slug, c.editToken, 'ip'), /đã là gói Đặc biệt/);
  });

  it('từ chối khi sai mã sửa, thiệp chưa trả hoặc đã hết hạn', async () => {
    const { clock, orderService, create, pay } = setup();
    const draft = await create('co-ban');
    await assert.rejects(orderService.createUpgrade(draft.slug, draft.editToken, 'ip'), /đang hoạt động/);
    await assert.rejects(orderService.createUpgrade(draft.slug, 'sai-ma-sua-nay-dai-du-16', 'ip'), /không đúng/);
    await pay(draft.orderCode, 15000);
    clock.tick(31 * DAY);
    await assert.rejects(orderService.createUpgrade(draft.slug, draft.editToken, 'ip'), /đang hoạt động/);
  });
});
