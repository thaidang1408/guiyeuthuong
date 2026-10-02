// Nhạc tự tải lên: nhận diện file, giới hạn dung lượng, phát từng đoạn (Range), lưu theo thiệp.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MUSIC_MAX_BYTES, detectAudioMime } from '../public/js/shared/audio.js';
import { parseRange, validateAudio } from '../functions/_lib/domain/audio.ts';
import { CardService } from '../functions/_lib/services/card-service.ts';
import { DAY, JPEG, MemoryDb, fakeClock } from './helpers/memory-db.ts';

const pad = (head: number[]) => new Uint8Array([...head, ...new Array(20).fill(0)]);
const MP3 = pad([0x49, 0x44, 0x33, 4, 0]);

describe('Nhận diện file nhạc', () => {
  it('nhận MP3, M4A, OGG, AAC theo chữ ký đầu file', () => {
    assert.equal(detectAudioMime(MP3), 'audio/mpeg');
    assert.equal(detectAudioMime(pad([0xff, 0xfb, 0x90])), 'audio/mpeg');
    assert.equal(detectAudioMime(pad([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70])), 'audio/mp4');
    assert.equal(detectAudioMime(pad([0x4f, 0x67, 0x67, 0x53])), 'audio/ogg');
    assert.equal(detectAudioMime(pad([0xff, 0xf1, 0x50])), 'audio/aac');
  });
  it('từ chối ảnh, file trống, file quá nặng', () => {
    assert.equal(detectAudioMime(pad([...JPEG])), null);
    assert.throws(() => validateAudio(pad([...JPEG])), /MP3, M4A/);
    assert.throws(() => validateAudio(new Uint8Array(0)), /trống/);
    const big = new Uint8Array(MUSIC_MAX_BYTES + 1);
    big.set(MP3);
    assert.throws(() => validateAudio(big), /nặng quá/);
  });
});

describe('Range (phát nhạc trên iPhone)', () => {
  it('tính đúng đoạn cần trả', () => {
    assert.equal(parseRange(null, 100), null);
    assert.deepEqual(parseRange('bytes=0-1', 100), { start: 0, end: 1 });
    assert.deepEqual(parseRange('bytes=10-', 100), { start: 10, end: 99 });
    assert.deepEqual(parseRange('bytes=-30', 100), { start: 70, end: 99 });
    assert.deepEqual(parseRange('bytes=90-500', 100), { start: 90, end: 99 });
    assert.equal(parseRange('bytes=100-', 100), 'invalid');
    assert.equal(parseRange('bytes=5-2', 100), 'invalid');
    assert.equal(parseRange('items=0-1', 100), 'invalid');
  });
});

describe('CardService với nhạc tự tải lên', () => {
  function setup() {
    const db = new MemoryDb();
    const clock = fakeClock();
    const service = new CardService({ cards: db, orders: db, rateLimits: db, now: clock.now });
    return { db, service, clock };
  }
  const base = { templateId: 'to-tinh', planId: 'dac-biet', images: [JPEG] };
  const data = (music: string) => ({ recipientName: 'Linh', senderName: 'Minh', music, texts: {} });

  it('lưu nhạc, chỉ phát khi thiệp đã kích hoạt, xóa khi hết hạn', async () => {
    const { db, service, clock } = setup();
    const res = await service.createCard({ ...base, data: data('tu-tai'), music: MP3 }, 'ip');
    assert.equal(await service.getMusic(res.slug), null); // chưa thanh toán
    await db.markPaidAndActivate(res.orderCode, clock.now(), clock.now() + 30 * DAY);
    assert.equal((await service.getMusic(res.slug))?.mime, 'audio/mpeg');
    clock.tick(31 * DAY);
    assert.equal(await service.getMusic(res.slug), null);
    assert.equal(db.music.size, 0);
  });

  it('chọn "nhạc của bạn" mà không gửi file thì dùng nhạc mặc định của mẫu', async () => {
    const { db, service } = setup();
    await service.createCard({ ...base, data: data('tu-tai') }, 'ip');
    assert.equal(JSON.parse(db.cards[0].dataJson).music, 'nhac-2');
  });

  it('gửi file nhưng chọn nhạc có sẵn thì không lưu file', async () => {
    const { db, service } = setup();
    await service.createCard({ ...base, data: data('nhac-1'), music: MP3 }, 'ip');
    assert.equal(db.music.size, 0);
  });

  it('từ chối file không phải nhạc', async () => {
    const { service } = setup();
    await assert.rejects(service.createCard({ ...base, data: data('tu-tai'), music: pad([...JPEG]) }, 'ip'), /MP3, M4A/);
  });
});
