// Test webhook SePay, trạng thái đơn, đổi gói và trang quản lý.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CardService } from '../functions/_lib/services/card-service.ts';
import { ManageService } from '../functions/_lib/services/manage-service.ts';
import { OrderService } from '../functions/_lib/services/order-service.ts';
import { PaymentService } from '../functions/_lib/services/payment-service.ts';
import { DAY, JPEG, MemoryDb, fakeClock } from './helpers/memory-db.ts';

const KEY = 'khoa-bi-mat-123';
const AUTH = `Apikey ${KEY}`;

async function setup(planId = 'co-ban', images = [JPEG]) {
  const db = new MemoryDb();
  const clock = fakeClock();
  const deps = { cards: db, orders: db, now: clock.now };
  const cardService = new CardService({ ...deps, rateLimits: db });
  const orderService = new OrderService({ ...deps, account: { acc: '0123456789', bank: 'MBBank' } });
  const paymentService = new PaymentService({ payments: db, orders: db, now: clock.now, webhookKey: KEY });
  const manageService = new ManageService(deps);
  const created = await cardService.createCard(
    { templateId: 'to-tinh', planId, data: { recipientName: 'Linh', senderName: 'Minh', texts: {} }, images },
    'ip',
  );
  return { db, clock, cardService, orderService, paymentService, manageService, created };
}

/** Dữ liệu giống SePay gửi. */
const sepay = (over: Record<string, unknown> = {}) => ({
  id: 92704,
  gateway: 'MBBank',
  transactionDate: '2026-10-10 14:02:37',
  accountNumber: '0123456789',
  code: null,
  content: 'NGUYEN VAN A chuyen tien',
  transferType: 'in',
  transferAmount: 15000,
  accumulated: 19077000,
  referenceCode: 'MBVCB.3278907687',
  description: '',
  ...over,
});

describe('webhook SePay', () => {
  it('đúng khóa, đủ tiền → đơn đã trả, thiệp hoạt động, hạn 30 ngày', async () => {
    const { db, clock, paymentService, cardService, created } = await setup();
    const outcome = await paymentService.handleWebhook(AUTH, sepay({ content: `CK ${created.orderCode.toLowerCase()} cam on` }));
    assert.equal(outcome, 'matched');
    assert.equal(db.orders[0].status, 'paid');
    assert.equal(db.cards[0].status, 'active');
    assert.equal(db.cards[0].expiresAt, clock.now() + 30 * DAY);
    assert.equal(db.payments[0].status, 'matched');
    assert.ok(await cardService.openForViewer(created.slug));
  });

  it('tìm mã đơn trong trường code nếu có', async () => {
    const { db, paymentService, created } = await setup();
    assert.equal(await paymentService.handleWebhook(AUTH, sepay({ code: created.orderCode, content: 'abc' })), 'matched');
    assert.equal(db.cards[0].status, 'active');
  });

  it('sai khóa, thiếu khóa hoặc chưa cấu hình khóa → 401, không ghi gì', async () => {
    const { db, paymentService, created } = await setup();
    const body = sepay({ content: created.orderCode });
    for (const auth of ['Apikey sai-khoa', KEY, `Bearer ${KEY}`, '', null]) {
      await assert.rejects(paymentService.handleWebhook(auth, body), (e: { status: number }) => e.status === 401);
    }
    const noKey = new PaymentService({ payments: db, orders: db, now: Date.now, webhookKey: undefined });
    await assert.rejects(noKey.handleWebhook('Apikey ', body), (e: { status: number }) => e.status === 401);
    assert.equal(db.payments.length, 0);
    assert.equal(db.cards[0].status, 'draft');
  });

  it('SePay gửi trùng giao dịch → chỉ xử lý một lần', async () => {
    const { db, paymentService, created } = await setup();
    const body = sepay({ content: created.orderCode });
    assert.equal(await paymentService.handleWebhook(AUTH, body), 'matched');
    assert.equal(await paymentService.handleWebhook(AUTH, body), 'duplicate');
    assert.equal(db.payments.length, 1);
  });

  it('chuyển thiếu tiền → cần duyệt tay, thiệp chưa hoạt động', async () => {
    const { db, paymentService, created } = await setup();
    assert.equal(await paymentService.handleWebhook(AUTH, sepay({ content: created.orderCode, transferAmount: 14000 })), 'needs_review');
    assert.equal(db.payments[0].status, 'needs_review');
    assert.equal(db.orders[0].status, 'pending');
    assert.equal(db.cards[0].status, 'draft');
  });

  it('chuyển dư tiền vẫn được kích hoạt', async () => {
    const { paymentService, created } = await setup();
    assert.equal(await paymentService.handleWebhook(AUTH, sepay({ content: created.orderCode, transferAmount: 20000 })), 'matched');
  });

  it('không có mã đơn hoặc mã không tồn tại → cần duyệt tay', async () => {
    const { db, paymentService } = await setup();
    assert.equal(await paymentService.handleWebhook(AUTH, sepay({ id: 1, content: 'tien an trua' })), 'needs_review');
    assert.equal(await paymentService.handleWebhook(AUTH, sepay({ id: 2, content: 'TXZZZZ' })), 'needs_review');
    assert.equal(db.payments.length, 2);
  });

  it('đơn đã trả rồi mà lại có tiền vào (chuyển 2 lần) → cần duyệt tay', async () => {
    const { paymentService, created } = await setup();
    await paymentService.handleWebhook(AUTH, sepay({ id: 1, content: created.orderCode }));
    assert.equal(await paymentService.handleWebhook(AUTH, sepay({ id: 2, content: created.orderCode })), 'needs_review');
  });

  it('chuyển muộn sau 30 phút vẫn kích hoạt', async () => {
    const { db, clock, paymentService, orderService, created } = await setup();
    clock.tick(45 * 60 * 1000);
    assert.equal((await orderService.getStatus(created.orderCode)).status, 'expired');
    assert.equal(await paymentService.handleWebhook(AUTH, sepay({ content: created.orderCode })), 'matched');
    assert.equal(db.cards[0].status, 'active');
    assert.equal((await orderService.getStatus(created.orderCode)).status, 'paid');
  });

  it('tiền ra (transferType "out") → bỏ qua, không ghi', async () => {
    const { db, paymentService, created } = await setup();
    assert.equal(await paymentService.handleWebhook(AUTH, sepay({ content: created.orderCode, transferType: 'out' })), 'ignored');
    assert.equal(db.payments.length, 0);
  });

  it('dữ liệu hỏng → lỗi 400', async () => {
    const { paymentService } = await setup();
    await assert.rejects(paymentService.handleWebhook(AUTH, { transferType: 'in' }), (e: { status: number }) => e.status === 400);
    await assert.rejects(paymentService.handleWebhook(AUTH, sepay({ transferAmount: 'nhieu' })), (e: { status: number }) => e.status === 400);
  });
});

describe('trạng thái đơn và đổi gói', () => {
  it('đơn chờ trả có QR đúng số tiền và nội dung, không lộ slug', async () => {
    const { orderService, created } = await setup();
    const view = await orderService.getStatus(created.orderCode);
    assert.equal(view.status, 'pending');
    assert.equal(view.payment?.content, created.orderCode);
    assert.match(view.payment!.qrUrl, /^https:\/\/vietqr\.app\/img\?acc=0123456789&bank=MBBank&amount=15000&des=TX[A-Z2-9]{4}&template=compact$/);
    assert.ok(!JSON.stringify(view).includes(created.slug));
  });

  it('đổi sang gói Đặc biệt cần đúng mã sửa, giá cập nhật', async () => {
    const { orderService, created } = await setup();
    await assert.rejects(orderService.changePlan(created.orderCode, 'dac-biet', created.slug, 'sai-ma-sua-thiep-0000'), /Link quản lý/);
    const view = await orderService.changePlan(created.orderCode, 'dac-biet', created.slug, created.editToken);
    assert.equal(view.amount, 29000);
    assert.equal(view.plan, 'dac-biet');
  });

  it('không cho đổi xuống gói ít ảnh hơn số ảnh đang có', async () => {
    const { orderService, created } = await setup('dac-biet', [JPEG, JPEG, JPEG, JPEG]);
    await assert.rejects(orderService.changePlan(created.orderCode, 'co-ban', created.slug, created.editToken), /tối đa 3 ảnh/);
  });
});

describe('trang quản lý', () => {
  it('sai mã sửa → không xem được', async () => {
    const { manageService, created } = await setup();
    await assert.rejects(manageService.getView(created.slug, 'x'.repeat(32)), /Link quản lý/);
  });

  it('thiệp nháp hiện mã đơn để quay lại thanh toán', async () => {
    const { manageService, created } = await setup();
    const view = await manageService.getView(created.slug, created.editToken);
    assert.equal(view.status, 'draft');
    assert.equal(view.pendingOrderCode, created.orderCode);
  });

  it('gói Đặc biệt sửa được lời nhắn sau khi gửi; gói Cơ bản thì không', async () => {
    const special = await setup('dac-biet');
    await special.orderService.activateOrder(special.created.orderCode);
    const view = await special.manageService.updateTexts(special.created.slug, special.created.editToken, {
      recipientName: 'Linh yêu',
      senderName: 'Minh',
      texts: { message: 'Lời nhắn mới' },
    });
    assert.equal(view.data.texts.message, 'Lời nhắn mới');
    assert.equal(view.data.recipientName, 'Linh yêu');
    assert.equal(view.data.music, 'nhac-2'); // nhạc giữ nguyên

    const basic = await setup('co-ban');
    await basic.orderService.activateOrder(basic.created.orderCode);
    await assert.rejects(
      basic.manageService.updateTexts(basic.created.slug, basic.created.editToken, { recipientName: 'A', senderName: 'B', texts: {} }),
      /gói Đặc biệt/,
    );
  });
});
