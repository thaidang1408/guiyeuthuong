// Các tính năng "tiên phong" sau khi thiệp đã gửi:
//   - Lời nhắn giọng nói (người tạo ghi âm lúc làm thiệp)
//   - "Mở cùng nhau": hai bên cùng bấm sẵn sàng, server hẹn một mốc chung để cùng mở
//   - Video phản ứng: người nhận TỰ ĐỒNG Ý quay và tự bấm gửi; chỉ người tạo (có mã sửa) xem được
//   - Sổ tình yêu chung: hai người viết thêm trang kỷ niệm (chữ + 1 ảnh) vào cùng một thiệp
import { detectRecordingMime, MEMORY_BOOK, REACTION, TOGETHER, VOICE } from '../../../public/js/shared/extras.js';
import { TEMPLATES } from '../../../public/js/shared/templates.js';
import type { CardData } from '../domain/card-data.ts';
import { AppError, badRequest, notFound, tooMany } from '../domain/errors.ts';
import { detectImageMime } from '../domain/images.ts';
import { findBadWord } from '../domain/profanity.ts';
import type { CardRecord, CardRepository, ExtrasRepository, MemoryEntry, RateLimitRepository, StoredImage, StoredMedia } from '../repositories/interfaces.ts';
import type { CardService } from './card-service.ts';
import { findCardWithToken } from './edit-token.ts';

const HOUR = 60 * 60 * 1000;
const LIMITS = {
  together: { max: 90, windowMs: 60 * 1000 }, // hỏi mỗi 2 giây ≈ 30 lần/phút cho mỗi người
  reaction: { max: 5, windowMs: HOUR },
  memory: { max: 20, windowMs: HOUR },
};

export interface ExtrasServiceDeps {
  cardService: CardService;
  cards: CardRepository;
  extras: ExtrasRepository;
  rateLimits: RateLimitRepository;
  now: () => number;
}

/** Kết quả mỗi lần hỏi "người kia sẵn sàng chưa?". startAt: mốc cùng mở (giờ server). */
export interface TogetherStatus {
  otherReady: boolean;
  startAt: number | null;
  serverNow: number;
}

/** Validate file ghi âm/ghi hình: dung lượng và loại file thật. */
export function validateRecording(bytes: Uint8Array, kind: 'audio' | 'video'): { mime: string; bytes: Uint8Array } {
  const max = kind === 'audio' ? VOICE.maxBytes : REACTION.maxBytes;
  const what = kind === 'audio' ? 'Lời nhắn giọng nói' : 'Video';
  if (!bytes.length) throw badRequest(`${what} bị trống.`);
  if (bytes.length > max) throw badRequest(`${what} dài quá (tối đa ${Math.round(max / 1024 / 1024)}MB).`);
  const mime = detectRecordingMime(bytes, kind);
  if (!mime) throw badRequest(`${what} không đúng định dạng.`);
  return { mime, bytes };
}

export const isMemoryBook = (templateId: string) => !!(TEMPLATES as Record<string, { memoryBook?: boolean }>)[templateId]?.memoryBook;

export class ExtrasService {
  deps: ExtrasServiceDeps;
  constructor(deps: ExtrasServiceDeps) {
    this.deps = deps;
  }

  private async limit(key: string, rule: { max: number; windowMs: number }, message: string) {
    if ((await this.deps.rateLimits.hit(key, this.deps.now(), rule.windowMs)) > rule.max) throw tooMany(message);
  }

  /** Thiệp đang hoạt động và đã tới giờ mở (hẹn giờ) — điều kiện chung của mọi tính năng ở đây. */
  private async openCard(slug: unknown): Promise<{ card: CardRecord; data: CardData }> {
    const card = typeof slug === 'string' ? await this.deps.cardService.findActiveCard(slug) : null;
    if (!card || this.deps.cardService.isWaiting(card)) throw notFound('Thiệp không tồn tại hoặc đã hết hạn.');
    return { card, data: JSON.parse(card.dataJson) as CardData };
  }

  // ---------- Lời nhắn giọng nói ----------

  async getVoice(slug: unknown): Promise<StoredMedia | null> {
    try {
      const { card, data } = await this.openCard(slug);
      return data.voice ? this.deps.extras.getMedia(card.id, 'voice') : null;
    } catch {
      return null;
    }
  }

  // ---------- Mở cùng nhau ----------

  /**
   * Một bên báo "mình sẵn sàng". side 'gui' (người tạo) phải kèm mã sửa; 'nhan' là người có link.
   * Khi cả hai cùng sẵn sàng, server chốt MỘT mốc startAt (lưu lại) để hai máy cùng đếm ngược và mở cùng lúc.
   */
  async together(slug: unknown, side: unknown, token: unknown, clientIp: string): Promise<TogetherStatus> {
    if (side !== 'gui' && side !== 'nhan') throw badRequest('Không rõ bạn là ai trong hai người.');
    const { card, data } = await this.openCard(slug);
    if (!data.together) throw badRequest('Thiệp này không bật "Mở cùng nhau".');
    if (side === 'gui') await findCardWithToken(this.deps.cards, slug, token);
    await this.limit(`cung:${clientIp}`, LIMITS.together, 'Bạn thao tác nhanh quá, đợi một lát nhé.');

    const now = this.deps.now();
    const seen = await this.deps.extras.touchPresence(card.id, side, now);
    const other = side === 'gui' ? 'nhan' : 'gui';
    const otherReady = !!seen[other] && now - seen[other] < TOGETHER.freshMs;
    let startAt: number | null = seen.start ?? null;
    // Mốc cũ (lần mở trước) thì bỏ, chốt mốc mới khi cả hai đang cùng chờ.
    if (startAt && now - startAt > 60_000) startAt = null;
    if (!startAt && otherReady) {
      startAt = now + TOGETHER.countdownMs;
      await this.deps.extras.setPresence(card.id, 'start', startAt);
    }
    return { otherReady, startAt, serverNow: now };
  }

  // ---------- Video phản ứng ----------

  /** Người nhận đã đồng ý quay và tự bấm gửi. Mỗi thiệp chỉ nhận một video (video đầu tiên). */
  async uploadReaction(slug: unknown, bytes: Uint8Array, clientIp: string): Promise<void> {
    const { card, data } = await this.openCard(slug);
    if (!data.reactionCam) throw badRequest('Thiệp này không xin quay phản ứng.');
    await this.limit(`quay:${clientIp}`, LIMITS.reaction, 'Bạn gửi nhiều lần quá, đợi một lát nhé.');
    const video = validateRecording(bytes, 'video');
    const saved = await this.deps.extras.putMedia(card.id, 'reaction', video.mime, video.bytes, this.deps.now());
    if (!saved) throw new AppError(409, 'Thiệp này đã nhận video phản ứng rồi.');
  }

  /** Chỉ người tạo (có mã sửa) xem được video phản ứng. */
  async getReaction(slug: unknown, token: unknown): Promise<StoredMedia | null> {
    const card = await findCardWithToken(this.deps.cards, slug, token);
    return this.deps.extras.getMedia(card.id, 'reaction');
  }

  /** Các trang sổ tình yêu của một thiệp (trang quản lý). */
  memoriesForCard(cardId: number): Promise<MemoryEntry[]> {
    return this.deps.extras.listMemories(cardId, MEMORY_BOOK.maxEntries);
  }

  /** Lúc nhận video phản ứng (cho trang quản lý), null nếu chưa có. */
  reactionReceivedAt(cardId: number): Promise<number | null> {
    return this.deps.extras.mediaCreatedAt(cardId, 'reaction');
  }

  // ---------- Sổ tình yêu chung ----------

  private async bookCard(slug: unknown) {
    const found = await this.openCard(slug);
    if (!isMemoryBook(found.card.template)) throw badRequest('Thiệp này không phải sổ tình yêu chung.');
    return found;
  }

  async listMemories(slug: unknown): Promise<MemoryEntry[]> {
    const { card } = await this.bookCard(slug);
    return this.deps.extras.listMemories(card.id, MEMORY_BOOK.maxEntries);
  }

  /** Ai có link cũng viết thêm được (link là bí mật giữa hai người); có giới hạn số trang, độ dài, lọc từ thô tục. */
  async addMemory(slug: unknown, input: { author: unknown; text: unknown; image: Uint8Array | null }, clientIp: string): Promise<MemoryEntry[]> {
    const { card } = await this.bookCard(slug);
    const author = input.author === 'gui' ? 'gui' : 'nhan';
    const text = (typeof input.text === 'string' ? input.text : '').normalize('NFC').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').replace(/\n{3,}/g, '\n\n').trim();
    if (!text) throw badRequest('Bạn viết vài dòng cho trang kỷ niệm này nhé.');
    if ([...text].length > MEMORY_BOOK.textMax) throw badRequest(`Mỗi trang tối đa ${MEMORY_BOOK.textMax} ký tự.`);
    const bad = findBadWord(text);
    if (bad) throw badRequest(`Trang này có từ chưa phù hợp ("${bad}"), bạn sửa lại giúp mình nhé.`);
    let image: StoredImage | null = null;
    if (input.image?.length) {
      if (input.image.length > MEMORY_BOOK.imageMaxBytes) throw badRequest('Ảnh nặng quá, bạn chọn ảnh khác nhé.');
      const mime = detectImageMime(input.image);
      if (!mime) throw badRequest('Ảnh phải là JPG, PNG hoặc WebP.');
      image = { mime, data: input.image };
    }
    if ((await this.deps.extras.countMemories(card.id)) >= MEMORY_BOOK.maxEntries) throw badRequest('Sổ đã đầy trang rồi 🥹');
    await this.limit(`so-tay:${clientIp}`, LIMITS.memory, 'Bạn viết nhanh quá, đợi một lát nhé.');
    await this.deps.extras.insertMemory(card.id, { author, text, image }, this.deps.now());
    return this.deps.extras.listMemories(card.id, MEMORY_BOOK.maxEntries);
  }

  async getMemoryImage(slug: unknown, id: number): Promise<StoredImage | null> {
    try {
      const { card } = await this.bookCard(slug);
      return Number.isInteger(id) ? this.deps.extras.getMemoryImage(card.id, id) : null;
    } catch {
      return null;
    }
  }

  /** Người tạo (có mã sửa) xóa một trang không muốn giữ. */
  async deleteMemory(slug: unknown, token: unknown, id: unknown): Promise<void> {
    const card = await findCardWithToken(this.deps.cards, slug, token);
    if (typeof id !== 'number' || !(await this.deps.extras.deleteMemory(card.id, id))) throw notFound('Trang này không còn nữa.');
  }
}
