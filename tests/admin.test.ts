// Trang quản trị (đăng nhập, kích hoạt thủ công, gỡ thiệp) và dọn dẹp không dùng cron.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSessionToken, readCookie, startOfDayVietnam, verifySessionToken } from '../functions/_lib/domain/admin-session.ts';
import { AdminService } from '../functions/_lib/services/admin-service.ts';
import { CardService } from '../functions/_lib/services/card-service.ts';
import { OrderService } from '../functions/_lib/services/order-service.ts';
import { DAY, JPEG, MemoryDb, fakeClock } from './helpers/memory-db.ts';

const PASSWORD = 'mat-khau-that-dai-123';

function setup(password: string | undefined = PASSWORD, isLocal = false) {
  const db = new MemoryDb();
  const clock = fakeClock();
  const cardService = new CardService({ cards: db, orders: db, rateLimits: db, now: clock.now });
  const orderService = new OrderService({ cards: db, orders: db, now: clock.now, account: null });
  const admin = new AdminService({ admin: db, cards: db, orders: db, orderService, rateLimits: db, now: clock.now, password, isLocal });
  const newCard = (ip = 'ip') =>
    cardService.createCard({ templateId: 'to-tinh', planId: 'co-ban', data: { recipientName: 'Linh', senderName: 'Minh', texts: {} }, images: [JPEG] }, ip);
  return { db, clock, cardService, admin, newCard };
}

describe('Phiên đăng nhập quản trị', () => {
  it('cookie hợp lệ trong 12 giờ, sai chữ ký hay đổi mật khẩu là hết hiệu lực', async () => {
    const now = Date.UTC(2026, 9, 10);
    const token = await createSessionToken(PASSWORD, now);
    assert.equal(await verifySessionToken(PASSWORD, token, now + 1000), true);
    assert.equal(await verifySessionToken(PASSWORD, token, now + 13 * 60 * 60 * 1000), false);
    assert.equal(await verifySessionToken('mat-khau-moi-khac-1', token, now), false);
    const forged = token.replace(/^\d+/, String(now + 99 * DAY));
    assert.equal(await verifySessionToken(PASSWORD, forged, now), false);
    assert.equal(await verifySessionToken(PASSWORD, null, now), false);
    assert.equal(readCookie('a=1; gyt_admin=xyz; b=2', 'gyt_admin'), 'xyz');
  });

  it('tính 0 giờ theo giờ Việt Nam', () => {
    // 10/10/2026 lúc 23:30 giờ VN = 16:30 UTC → đầu ngày là 10/10 00:00 VN = 09/10 17:00 UTC
    assert.equal(startOfDayVietnam(Date.UTC(2026, 9, 10, 16, 30)), Date.UTC(2026, 9, 9, 17));
    // 11/10 lúc 00:30 giờ VN = 10/10 17:30 UTC → đầu ngày 11/10
    assert.equal(startOfDayVietnam(Date.UTC(2026, 9, 10, 17, 30)), Date.UTC(2026, 9, 10, 17));
  });

  it('sai mật khẩu bị từ chối, thử quá 5 lần bị chặn', async () => {
    const { admin } = setup();
    await assert.rejects(admin.login('sai', 'ip'), /Sai mật khẩu/);
    const token = await admin.login(PASSWORD, 'ip');
    assert.equal(await admin.isLoggedIn(token), true);
    for (let i = 0; i < 3; i++) await admin.login('sai', 'ip').catch(() => {});
    await assert.rejects(admin.login(PASSWORD, 'ip'), /đợi 15 phút/);
  });

  it('trên mạng: không có mật khẩu, mật khẩu ngắn hay mật khẩu mẫu thì trang quản trị tắt', async () => {
    for (const p of ['', 'ngan', 'doi-mat-khau-nay']) {
      const { admin } = setup(p);
      await assert.rejects(admin.login(p, 'ip'), /chưa bật/);
      assert.equal(await admin.isLoggedIn('123.abc'), false);
    }
    // Ở máy thì cho dùng mật khẩu mẫu để thử.
    const { admin } = setup('doi-mat-khau-nay', true);
    assert.ok(await admin.login('doi-mat-khau-nay', 'ip'));
  });
});

describe('Xử lý trên trang quản trị', () => {
  it('kích hoạt thủ công đơn chuyển thiếu, giao dịch được đánh dấu đã xử lý, doanh thu tăng', async () => {
    const { db, admin, clock, newCard } = setup();
    const res = await newCard();
    db.payments.push({ id: 1, sepayId: 's1', orderCode: res.orderCode, amount: 10000, content: res.orderCode, status: 'needs_review', rawJson: '{}', createdAt: clock.now(), resolvedAt: null });

    let dash = await admin.dashboard();
    assert.equal(dash.payments.length, 1);
    assert.equal(dash.payments[0].orderAmount, 15000);
    assert.equal(dash.revenue.today.total, 0);

    await admin.activate(res.orderCode.toLowerCase(), 1);
    assert.equal(db.cards[0].status, 'active');
    dash = await admin.dashboard();
    assert.equal(dash.payments.length, 0);
    assert.deepEqual(dash.revenue.today, { orders: 1, total: 15000 });
    // Đếm lượt giao dịch SePay của tháng (để canh giới hạn 50 giao dịch/tháng của gói miễn phí).
    assert.deepEqual(dash.sepay, { used: 1, limit: 50 });
    await assert.rejects(admin.activate(res.orderCode, 1), /đã thanh toán/);
    await assert.rejects(admin.activate('TXZZZZ', null), /Không tìm thấy đơn/);
  });

  it('gỡ thiệp: link chết, ảnh bị xóa, báo cáo được đóng', async () => {
    const { db, admin, cardService, clock, newCard } = setup();
    const res = await newCard();
    await db.markPaidAndActivate(res.orderCode, clock.now(), clock.now() + 30 * DAY);
    await db.insert(1, 'Nội dung xúc phạm', clock.now());
    assert.equal((await admin.dashboard()).reports.length, 1);

    await admin.removeCard(res.slug);
    assert.equal(await cardService.findActiveCard(res.slug), null);
    assert.equal(db.images.size, 0);
    assert.equal((await admin.dashboard()).reports.length, 0);
    await assert.rejects(admin.removeCard(res.slug), /đã được gỡ/);
  });

  it('tìm theo mã đơn hoặc mã thiệp', async () => {
    const { admin, newCard } = setup();
    const res = await newCard();
    assert.equal((await admin.search(res.orderCode.toLowerCase()))[0].slug, res.slug);
    assert.equal((await admin.search(res.slug))[0].code, res.orderCode);
    await assert.rejects(admin.search('<script>'), /Nhập mã đơn/);
  });
});

describe('Dọn dẹp mỗi lần có đơn mới', () => {
  it('xóa thiệp nháp quá 24 giờ, giữ nháp có giao dịch cần xem, chuyển thiệp hết hạn và xóa ảnh', async () => {
    const { db, clock, newCard } = setup();
    const oldDraft = await newCard('a');
    const disputed = await newCard('b');
    db.payments.push({ id: 1, sepayId: 's1', orderCode: disputed.orderCode, amount: 1000, content: null, status: 'needs_review', rawJson: '{}', createdAt: clock.now(), resolvedAt: null });
    const paid = await newCard('c');
    await db.markPaidAndActivate(paid.orderCode, clock.now(), clock.now() + 30 * DAY);

    clock.tick(31 * DAY);
    await newCard('d');

    assert.equal(await db.findBySlug(oldDraft.slug), null);
    assert.equal(await db.findByCode(oldDraft.orderCode), null);
    assert.equal((await db.findBySlug(disputed.slug))?.status, 'draft');
    assert.equal((await db.findBySlug(paid.slug))?.status, 'expired');
    assert.equal(await db.getImage((await db.findBySlug(paid.slug))!.id, 0), null);
  });
});
