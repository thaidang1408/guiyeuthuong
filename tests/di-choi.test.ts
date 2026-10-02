// Mẫu "Đi chơi với tớ không?": người nhận chọn ngày + món, người tạo xem ở trang quản lý.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateAnswer } from '../functions/_lib/domain/di-choi.ts';
import { CardService } from '../functions/_lib/services/card-service.ts';
import { ManageService } from '../functions/_lib/services/manage-service.ts';
import { ResponseService } from '../functions/_lib/services/response-service.ts';
import { DAY, JPEG, MemoryDb, fakeClock } from './helpers/memory-db.ts';

const NOW = Date.UTC(2026, 9, 10, 3); // 10/10/2026 10 giờ sáng giờ VN

describe('Kiểm tra câu trả lời', () => {
  it('nhận ngày hợp lệ, làm gọn chữ', () => {
    assert.deepEqual(validateAnswer({ date: '2026-10-18', food: '  🍲  Lẩu ', note: 'Hẹn\n7 giờ nha' }, NOW), {
      date: '2026-10-18',
      food: '🍲 Lẩu',
      note: 'Hẹn 7 giờ nha',
    });
  });
  it('từ chối ngày sai, ngày đã qua lâu, quá 1 năm, thiếu món, từ thô tục, chữ quá dài', () => {
    assert.throws(() => validateAnswer({ date: '2026-02-30', food: 'Lẩu' }, NOW), /không hợp lệ/);
    assert.throws(() => validateAnswer({ date: '18/10/2026', food: 'Lẩu' }, NOW), /chưa chọn ngày/);
    assert.throws(() => validateAnswer({ date: '2026-10-01', food: 'Lẩu' }, NOW), /một năm/);
    assert.throws(() => validateAnswer({ date: '2027-12-01', food: 'Lẩu' }, NOW), /một năm/);
    assert.throws(() => validateAnswer({ date: '2026-10-18', food: ' ' }, NOW), /chưa chọn món/);
    assert.throws(() => validateAnswer({ date: '2026-10-18', food: 'Lẩu', note: 'đồ chó' }, NOW), /chưa phù hợp/);
    assert.throws(() => validateAnswer({ date: '2026-10-18', food: 'a'.repeat(41) }, NOW), /dài quá/);
  });
});

describe('Gửi và xem câu trả lời', () => {
  async function setup(template = 'di-choi') {
    const db = new MemoryDb();
    const clock = fakeClock(NOW);
    const cardService = new CardService({ cards: db, orders: db, rateLimits: db, now: clock.now });
    const responses = new ResponseService({
      cardService,
      cards: db,
      responses: db.responseRepo,
      rateLimits: db,
      now: clock.now,
    });
    const manage = new ManageService({ cards: db, orders: db, now: clock.now, responses });
    const res = await cardService.createCard(
      { templateId: template, planId: 'co-ban', data: { recipientName: 'Linh', senderName: 'Minh', texts: {} }, images: [JPEG] },
      'ip',
    );
    return { db, clock, responses, manage, res };
  }

  it('chỉ thiệp đã kích hoạt mới nhận câu trả lời; người tạo thấy ở trang quản lý', async () => {
    const { db, clock, responses, manage, res } = await setup();
    const answer = { date: '2026-10-18', food: '🍲 Lẩu', note: 'Đi sớm nha' };
    await assert.rejects(responses.submit(res.slug, answer, 'nguoi-nhan'), /Không tìm thấy/);
    await db.markPaidAndActivate(res.orderCode, clock.now(), clock.now() + 30 * DAY);
    await responses.submit(res.slug, answer, 'nguoi-nhan');
    const view = await manage.getView(res.slug, res.editToken);
    assert.deepEqual(view.responses, [{ kind: 'di-choi', ...answer, createdAt: NOW }]);
  });

  it('mẫu khác không nhận câu chọn ngày/món', async () => {
    const { db, clock, responses, manage, res } = await setup('to-tinh');
    await db.markPaidAndActivate(res.orderCode, clock.now(), clock.now() + 30 * DAY);
    await assert.rejects(responses.submit(res.slug, { date: '2026-10-18', food: 'Lẩu' }, 'ip'), /Không tìm thấy/);
    assert.deepEqual((await manage.getView(res.slug, res.editToken)).responses, []);
  });

  it('giới hạn 10 câu mỗi giờ cho một người, 20 câu mỗi thiệp', async () => {
    const { db, clock, responses, res } = await setup();
    await db.markPaidAndActivate(res.orderCode, clock.now(), clock.now() + 30 * DAY);
    const answer = { date: '2026-10-18', food: 'Lẩu' };
    for (let i = 0; i < 10; i++) await responses.submit(res.slug, answer, 'a');
    await assert.rejects(responses.submit(res.slug, answer, 'a'), /nhiều quá/);
    for (let i = 0; i < 10; i++) await responses.submit(res.slug, answer, 'b');
    await assert.rejects(responses.submit(res.slug, answer, 'c'), /đủ câu trả lời/);
  });
});
