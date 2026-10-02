// Test lớp dịch vụ với cơ sở dữ liệu giả lập trong bộ nhớ (không cần Cloudflare).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CardService } from '../functions/_lib/services/card-service.ts';
import { OrderService } from '../functions/_lib/services/order-service.ts';
import { DAY, JPEG, MemoryDb, fakeClock } from './helpers/memory-db.ts';

function setup() {
  const db = new MemoryDb();
  const clock = fakeClock();
  const service = new CardService({ cards: db, orders: db, rateLimits: db, now: clock.now });
  const orders = new OrderService({ cards: db, orders: db, now: clock.now, account: null });
  return { db, service, orders, clock };
}

const input = {
  templateId: 'to-tinh',
  planId: 'co-ban',
  data: { recipientName: 'Linh', senderName: 'Minh', texts: {} },
  images: [JPEG],
};

describe('CardService.createCard', () => {
  it('tạo thiệp nháp + đơn chờ thanh toán với giá lấy từ server', async () => {
    const { db, service } = setup();
    const res = await service.createCard(input, '1.2.3.4');
    assert.equal(res.amount, 15000);
    assert.match(res.orderCode, /^TX[A-Z2-9]{4}$/);
    assert.equal(db.cards[0].status, 'draft');
    assert.notEqual(db.cards[0].editTokenHash, res.editToken); // chỉ lưu bản băm
    assert.equal(db.cards[0].editTokenHash.length, 64);
  });

  it('chặn khi một IP tạo quá 10 đơn/giờ', async () => {
    const { service } = setup();
    for (let i = 0; i < 10; i++) await service.createCard(input, '9.9.9.9');
    await assert.rejects(service.createCard(input, '9.9.9.9'), /nhiều đơn/);
    await service.createCard(input, '8.8.8.8'); // IP khác vẫn được
  });

  it('dữ liệu sai thì không ghi gì vào cơ sở dữ liệu', async () => {
    const { db, service } = setup();
    await assert.rejects(service.createCard({ ...input, images: [JPEG, JPEG, JPEG, JPEG] }, 'ip'), /tối đa 3 ảnh/);
    assert.equal(db.cards.length, 0);
    assert.equal(db.hits.size, 0);
  });
});

describe('CardService: kích hoạt, xem thiệp, hết hạn', () => {
  it('thiệp nháp chưa xem được; trả tiền xong thì xem được và đặt đúng hạn', async () => {
    const { db, service, orders, clock } = setup();
    const res = await service.createCard(input, 'ip');
    assert.equal(await service.openForViewer(res.slug), null);

    assert.equal(await orders.activateOrder(res.orderCode), true);
    assert.equal(await orders.activateOrder(res.orderCode), false); // gọi lại không xử lý lần hai
    assert.equal(db.cards[0].expiresAt, clock.now() + 30 * DAY);

    const card = await service.openForViewer(res.slug);
    assert.equal(card?.data.recipientName, 'Linh');
    assert.equal(db.cards[0].views, 1);
  });

  it('quá hạn thì chuyển sang expired và xóa ảnh', async () => {
    const { db, service, orders, clock } = setup();
    const res = await service.createCard(input, 'ip');
    await orders.activateOrder(res.orderCode);
    assert.ok(await service.getImage(res.slug, 0, null));
    clock.tick(30 * DAY);
    assert.equal(await service.openForViewer(res.slug), null);
    assert.equal(db.cards[0].status, 'expired');
    assert.equal(db.images.size, 0);
  });

  it('ảnh của thiệp nháp chỉ xem được khi kèm đúng mã đơn', async () => {
    const { service } = setup();
    const res = await service.createCard(input, 'ip');
    assert.equal(await service.getImage(res.slug, 0, null), null);
    assert.equal(await service.getImage(res.slug, 0, 'TXZZZZ'), null);
    assert.ok(await service.getImage(res.slug, 0, res.orderCode));
    assert.equal(await service.getImage(res.slug, 1, res.orderCode), null);
  });
});
