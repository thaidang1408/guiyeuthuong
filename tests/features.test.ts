// Tính năng tăng lan truyền: phản ứng người nhận, thư đáp lại, khóa câu hỏi, thiệp nhóm, thư "Mở khi…".
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { inviteTokenFromEditToken } from '../public/js/shared/combo.js';
import { hashAnswer, normalizeAnswer } from '../public/js/shared/lock.js';
import { validateCardData } from '../functions/_lib/domain/card-data.ts';
import { CardService } from '../functions/_lib/services/card-service.ts';
import { GroupService } from '../functions/_lib/services/group-service.ts';
import { ManageService } from '../functions/_lib/services/manage-service.ts';
import { ResponseService } from '../functions/_lib/services/response-service.ts';
import { DAY, JPEG, MemoryDb, fakeClock } from './helpers/memory-db.ts';

const NOW = Date.UTC(2026, 9, 10, 3); // 10/10/2026 10 giờ sáng giờ VN

function setup() {
  const db = new MemoryDb();
  const clock = fakeClock(NOW);
  const cardService = new CardService({ cards: db, orders: db, rateLimits: db, now: clock.now, signatures: db.signatureRepo });
  const responses = new ResponseService({ cardService, cards: db, responses: db.responseRepo, rateLimits: db, now: clock.now });
  const manage = new ManageService({ cards: db, orders: db, now: clock.now, responses, signatures: db.signatureRepo });
  const group = new GroupService({ cards: db, signatures: db.signatureRepo, rateLimits: db, now: clock.now });
  const create = async (templateId: string, texts: Record<string, string> = {}, extra: Record<string, unknown> = {}, pay = true) => {
    const res = await cardService.createCard(
      { templateId, planId: 'co-ban', data: { recipientName: 'Linh', senderName: 'Minh', texts, ...extra }, images: [JPEG] },
      'ip',
    );
    if (pay) await db.markPaidAndActivate(res.orderCode, clock.now(), clock.now() + 30 * DAY);
    return res;
  };
  return { db, clock, cardService, responses, manage, group, create };
}

describe('Khóa câu hỏi bí mật', () => {
  it('đáp án so khớp không phân biệt dấu, hoa thường, khoảng trắng', async () => {
    assert.equal(normalizeAnswer('  Hà   Nội! '), 'ha noi');
    assert.equal(normalizeAnswer('Đà Lạt'), 'da lat');
    assert.equal(await hashAnswer('Hà Nội'), await hashAnswer('ha  noi'));
    assert.notEqual(await hashAnswer('Hà Nội'), await hashAnswer('Hải Phòng'));
  });
  it('server chỉ giữ câu hỏi + bản băm hợp lệ; thiếu thì coi như không khóa', async () => {
    const base = { recipientName: 'Linh', senderName: 'Minh', texts: {} };
    const answerHash = await hashAnswer('Đà Lạt');
    const d = validateCardData('to-tinh', { ...base, lock: { question: ' Mình gặp nhau ở đâu? ', hint: 'Thành phố sương mù', answerHash, answer: 'lộ!' } });
    assert.deepEqual(d.lock, { question: 'Mình gặp nhau ở đâu?', hint: 'Thành phố sương mù', answerHash });
    assert.equal(validateCardData('to-tinh', { ...base, lock: { question: 'Hỏi?', answerHash: 'abc' } }).lock, null);
    assert.equal(validateCardData('to-tinh', { ...base, lock: { question: '', answerHash } }).lock, null);
    assert.throws(() => validateCardData('to-tinh', { ...base, lock: { question: 'x'.repeat(101), answerHash } }), /dài quá/);
  });
});

describe('Phản ứng và thư đáp lại', () => {
  it('ghi lần mở, lần bấm "Có" đầu tiên; người tạo xem ở trang quản lý', async () => {
    const { clock, cardService, responses, manage, create } = setup();
    const res = await create('to-tinh');
    await cardService.openForViewer(res.slug);
    clock.tick(60_000);
    await cardService.openForViewer(res.slug);
    await responses.react(res.slug, { noPresses: 14, thinkMs: 72_000 }, 'a');
    await responses.react(res.slug, { noPresses: 0, thinkMs: 1 }, 'a'); // lần sau không ghi đè
    const view = await manage.getView(res.slug, res.editToken);
    assert.deepEqual(view.reactions, { firstOpenedAt: NOW, lastOpenedAt: NOW + 60_000, yesAt: NOW + 60_000, noPresses: 14, thinkMs: 72_000 });
    assert.equal(view.views, 2);
  });

  it('thư đáp lại: lưu, lọc từ thô tục, giới hạn độ dài, chỉ thiệp đã kích hoạt', async () => {
    const { responses, manage, create } = setup();
    const draft = await create('xin-loi', {}, {}, false);
    await assert.rejects(responses.reply(draft.slug, 'Tha rồi', 'a'), /Không tìm thấy/);
    const res = await create('xin-loi');
    await responses.reply(res.slug, '  Tha rồi đó,\n\n\n\nlần sau đừng vậy nữa 😤 ', 'a');
    await assert.rejects(responses.reply(res.slug, 'đồ chó', 'a'), /chưa phù hợp/);
    await assert.rejects(responses.reply(res.slug, 'a'.repeat(501), 'a'), /dài quá/);
    await assert.rejects(responses.reply(res.slug, '   ', 'a'), /vài chữ/);
    const view = await manage.getView(res.slug, res.editToken);
    assert.deepEqual(view.responses, [{ kind: 'reply', text: 'Tha rồi đó,\n\nlần sau đừng vậy nữa 😤', createdAt: NOW }]);
  });
});

describe('Sticker', () => {
  it('người tạo gắn tối đa 3 sticker hợp lệ, không trùng', () => {
    const base = { recipientName: 'Linh', senderName: 'Minh', texts: {} };
    assert.deepEqual(validateCardData('to-tinh', { ...base, stickers: ['iu', 'iu', 'hack', 'moa', 'thuong', 'me'] }).stickers, ['iu', 'moa', 'thuong']);
    assert.deepEqual(validateCardData('to-tinh', { ...base, stickers: 'iu' }).stickers, []);
  });

  it('người nhận thả sticker đáp lại, người tạo xem ở trang quản lý', async () => {
    const { responses, manage, create } = setup();
    const res = await create('to-tinh');
    await responses.sticker(res.slug, 'rung-rung', 'a');
    await assert.rejects(responses.sticker(res.slug, 'hack', 'a'), /không hợp lệ/);
    await assert.rejects(responses.sticker(res.slug, 'doi', 'a'), /không hợp lệ/); // không có trong bộ đáp lại
    const view = await manage.getView(res.slug, res.editToken);
    assert.deepEqual(view.responses, [{ kind: 'sticker', id: 'rung-rung', createdAt: NOW }]);
  });

  it('mỗi sticker đều có đủ file ảnh động và ảnh tĩnh', async () => {
    const { existsSync } = await import('node:fs');
    const { STICKERS, REPLY_STICKERS, stickerSrc } = await import('../public/js/shared/stickers.js');
    for (const s of STICKERS) {
      for (const still of [false, true]) assert.ok(existsSync(new URL(`../public${stickerSrc(s.id, still)}`, import.meta.url)), `${s.id} ${still}`);
    }
    for (const id of REPLY_STICKERS) assert.ok(STICKERS.some((s) => s.id === id), id);
  });
});

describe('Thiệp nhóm', () => {
  it('thành viên ký bằng link mời (kể cả khi chưa thanh toán), người nhận thấy lời chúc, người tổ chức xóa được', async () => {
    const { db, clock, cardService, manage, group, create } = setup();
    const res = await create('ca-nhom', { groupName: 'Lớp 12A1' }, { relationship: 'co-giao' }, false);
    const token = await inviteTokenFromEditToken(res.editToken);

    await assert.rejects(group.info(res.slug, 'ABCDEFGHJKLMNPQR'), /không đúng/);
    await assert.rejects(group.info(res.slug, res.editToken), /không đúng/);
    let info = await group.info(res.slug, token);
    assert.equal(info.groupName, 'Lớp 12A1');
    assert.equal(info.isActive, false);

    info = await group.sign(res.slug, token, { name: ' An ', message: 'Chúc cô vui!', sticker: '🌷' }, 'x');
    await group.sign(res.slug, token, { name: 'Bình', message: 'Thương cô', sticker: '<b>' }, 'y');
    assert.deepEqual((await group.info(res.slug, token)).names, ['An', 'Bình']);
    await assert.rejects(group.sign(res.slug, token, { name: 'C', message: 'đồ chó' }, 'z'), /chưa phù hợp/);
    await assert.rejects(group.sign(res.slug, token, { name: '', message: 'Hi' }, 'z'), /chưa điền tên/);

    await db.markPaidAndActivate(res.orderCode, clock.now(), clock.now() + 30 * DAY);
    const card = await cardService.openForViewer(res.slug);
    assert.deepEqual(card?.signatures, [
      { name: 'An', message: 'Chúc cô vui!', sticker: '🌷' },
      { name: 'Bình', message: 'Thương cô', sticker: '💐' }, // nhãn lạ → nhãn mặc định
    ]);

    let view = await manage.getView(res.slug, res.editToken);
    assert.equal(view.signatures?.length, 2);
    assert.equal(view.maxSignatures, 15);
    view = await manage.deleteSignature(res.slug, res.editToken, view.signatures![1].id);
    assert.deepEqual(view.signatures?.map((s) => s.name), ['An']);
  });

  it('đủ số chữ ký theo gói thì dừng; thiệp thường không có link mời', async () => {
    const { group, create } = setup();
    const res = await create('ca-nhom');
    const token = await inviteTokenFromEditToken(res.editToken);
    for (let i = 0; i < 15; i++) await group.sign(res.slug, token, { name: `Bạn ${i}`, message: 'Chúc mừng' }, `ip${i}`);
    await assert.rejects(group.sign(res.slug, token, { name: 'Muộn', message: 'Chúc mừng' }, 'late'), /đủ 15/);

    const normal = await create('to-tinh');
    await assert.rejects(group.info(normal.slug, await inviteTokenFromEditToken(normal.editToken)), /không đúng/);
  });
});

describe('Thư "Mở khi…"', () => {
  it('thư chưa tới ngày: server không gửi nội dung cho người nhận; người tạo vẫn thấy đủ', async () => {
    const { clock, cardService, manage, create } = setup();
    const res = await create('mo-khi', { l1Date: '2026-10-10', l2Date: '2026-10-11', l3Date: '' });
    let card = await cardService.openForViewer(res.slug);
    assert.ok(card!.data.texts.l1Body.length > 10); // đúng ngày hôm nay → mở được
    assert.equal(card!.data.texts.l2Body, ''); // ngày mai → khóa
    assert.equal(card!.data.texts.l2Date, '2026-10-11'); // vẫn biết ngày mở để hiện "Mở vào…"
    assert.ok(card!.data.texts.l3Body.length > 10);
    assert.ok((await manage.getView(res.slug, res.editToken)).data.texts.l2Body.length > 10);

    clock.tick(DAY); // sang 11/10
    card = await cardService.openForViewer(res.slug);
    assert.ok(card!.data.texts.l2Body.length > 10);
  });
});

describe('Hiệu ứng đặc biệt', () => {
  const base = { recipientName: 'Linh', senderName: 'Minh', texts: {} };

  it('giữ id hợp lệ, bỏ id lạ, kiểm tra câu trong màn kết', () => {
    const d = validateCardData('to-tinh', { ...base, fx: { opening: 'hop-qua', finale: 'thien-ha', phrase: '  Anh yêu em  ' } });
    assert.deepEqual(d.fx, { opening: 'hop-qua', finale: 'thien-ha', bg: '', phrase: 'Anh yêu em' });
    const odd = validateCardData('to-tinh', { ...base, fx: { opening: '<script>', finale: 42, phrase: null } });
    assert.deepEqual(odd.fx, { opening: '', finale: '', bg: '', phrase: '' });
    assert.deepEqual(validateCardData('to-tinh', base).fx, { opening: '', finale: '', bg: '', phrase: '' });
    assert.equal(validateCardData('to-tinh', { ...base, fx: { bg: 'dom-dom' } }).fx?.bg, 'dom-dom');
    assert.throws(() => validateCardData('to-tinh', { ...base, fx: { phrase: 'x'.repeat(41) } }), /dài quá/);
  });
});

describe('Trò chơi cuối thiệp', () => {
  const base = { recipientName: 'Linh', senderName: 'Minh', texts: {} };
  const quiz = [
    { q: 'Gặp nhau ở đâu?', options: ['Trường', '', 'Quán'], answer: 2 },
    { q: 'Món mê nhất?', options: ['Lẩu', 'Bún'], answer: 1 },
  ];

  it('làm sạch dữ liệu: chỉ giữ trò được chọn, bỏ ô trống mà vẫn đúng đáp án', () => {
    assert.deepEqual(validateCardData('to-tinh', { ...base, game: { id: 'vong-quay', prizes: [' Trà sữa ', '', 'Xem phim'], quiz } }).game, {
      id: 'vong-quay',
      prizes: ['Trà sữa', 'Xem phim'],
    });
    const d = validateCardData('to-tinh', { ...base, game: { id: 'cau-do', quiz } });
    assert.deepEqual(d.game?.quiz?.[0], { q: 'Gặp nhau ở đâu?', options: ['Trường', 'Quán'], answer: 1 });
    assert.deepEqual(validateCardData('to-tinh', { ...base, game: { id: 'hack' } }).game, { id: '' });
    assert.throws(() => validateCardData('to-tinh', { ...base, game: { id: 'vong-quay', prizes: ['Một'] } }), /ít nhất 2/);
    assert.throws(() => validateCardData('to-tinh', { ...base, game: { id: 'vong-quay', prizes: ['đồ chó', 'x'] } }), /chưa phù hợp/);
  });

  it('vòng quay: server bốc thăm, chỉ quay 1 lần, người tạo xem kết quả', async () => {
    const { responses, manage, create } = setup();
    const res = await create('to-tinh', {}, { game: { id: 'vong-quay', prizes: ['Trà sữa', 'Xem phim', 'Ôm'] } });
    const first = await responses.play(res.slug, { kind: 'vong-quay' }, 'a', () => 0.5);
    assert.deepEqual(first, { kind: 'vong-quay', index: 1, prize: 'Xem phim' });
    assert.deepEqual(await responses.play(res.slug, { kind: 'vong-quay' }, 'a', () => 0.99), first); // quay lại vẫn ra quà cũ
    await assert.rejects(responses.play(res.slug, { kind: 'cau-do', answers: [] }, 'a'), /không có trò chơi/);
    const view = await manage.getView(res.slug, res.editToken);
    assert.deepEqual(view.responses, [{ kind: 'vong-quay', index: 1, prize: 'Xem phim', createdAt: NOW }]);
  });

  it('câu đố: server chấm điểm, kiểm tra câu trả lời, chỉ ghi lần đầu', async () => {
    const { responses, manage, create } = setup();
    const res = await create('to-tinh', {}, { game: { id: 'cau-do', quiz } });
    await assert.rejects(responses.play(res.slug, { kind: 'cau-do', answers: [1] }, 'a'), /chưa đủ/);
    await assert.rejects(responses.play(res.slug, { kind: 'cau-do', answers: [1, 5] }, 'a'), /không hợp lệ/);
    assert.deepEqual(await responses.play(res.slug, { kind: 'cau-do', answers: [1, 0] }, 'a'), { kind: 'cau-do', score: 1, total: 2 });
    assert.deepEqual(await responses.play(res.slug, { kind: 'cau-do', answers: [1, 1] }, 'a'), { kind: 'cau-do', score: 1, total: 2 });
    const view = await manage.getView(res.slug, res.editToken);
    assert.deepEqual(view.responses, [{ kind: 'cau-do', answers: [1, 0], score: 1, total: 2, createdAt: NOW }]);
  });

  it('thiệp không có trò chơi hoặc chưa thanh toán thì không chơi được', async () => {
    const { responses, create } = setup();
    const plain = await create('to-tinh');
    await assert.rejects(responses.play(plain.slug, { kind: 'vong-quay' }, 'a'), /không có trò chơi/);
    const draft = await create('to-tinh', {}, { game: { id: 'vong-quay', prizes: ['A', 'B'] } }, false);
    await assert.rejects(responses.play(draft.slug, { kind: 'vong-quay' }, 'a'), /Không tìm thấy/);
  });
});

describe('Cam kết hoàn tiền', () => {
  it('trang quản lý có mã đơn + lúc trả tiền để yêu cầu hoàn trong thời gian cam kết', async () => {
    const { manage, create } = setup();
    const res = await create('to-tinh');
    const view = await manage.getView(res.slug, res.editToken);
    assert.equal(view.paidOrder?.code, res.orderCode);
    assert.equal(view.paidOrder?.paidAt, NOW);
    const draft = await create('to-tinh', {}, {}, false);
    assert.equal((await manage.getView(draft.slug, draft.editToken)).paidOrder, null);
  });

  it('chỉ gói Cơ bản/Đặc biệt, trong 24 giờ', async () => {
    const { withinGuarantee } = await import('../public/js/shared/plans.js');
    assert.equal(withinGuarantee('co-ban', NOW, NOW + 23 * 3600_000), true);
    assert.equal(withinGuarantee('dac-biet', NOW, NOW + 25 * 3600_000), false);
    assert.equal(withinGuarantee('combo', NOW, NOW + 3600_000), false);
    assert.equal(withinGuarantee('co-ban', null, NOW), false);
  });
});
