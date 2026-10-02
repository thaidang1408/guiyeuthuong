import { CLEANUP, COMBO_CHECK_LIMIT, COMBO_LIMIT, ORDER_TTL_MS, RATE_LIMIT_ORDERS } from '../config.ts';
import { COMBO_CODE_PATTERN, comboCodeFromEditToken, inviteTokenFromEditToken, normalizeComboCode } from '../../../public/js/shared/combo.js';
import { TEMPLATES } from '../../../public/js/shared/templates.js';
import { lockedLetterKeys } from '../domain/letters.ts';
import { COMBO_CARD_PLAN, PLANS, premiumBlock } from '../../../public/js/shared/plans.js';
import { CUSTOM_MUSIC_ID } from '../../../public/js/shared/audio.js';
import { validateAudio } from '../domain/audio.ts';
import { validateRecording } from './extras-service.ts';
import { type CardData, getReadyTemplate, validateCardData } from '../domain/card-data.ts';
import { openAtMs } from '../../../public/js/shared/schedule.js';
import { AppError, badRequest, tooMany } from '../domain/errors.ts';
import { ORDER_CODE_PATTERN, SLUG_PATTERN, newEditToken, newOrderCode, newSlug, sha256Hex } from '../domain/ids.ts';
import { validateImages } from '../domain/images.ts';
import { computeExpiry, getPlan, isExpired } from '../domain/plans.ts';
import type {
  CardRecord,
  CardRepository,
  OrderRepository,
  RateLimitRepository,
  SignatureRepository,
  StoredImage,
} from '../repositories/interfaces.ts';

export interface CardServiceDeps {
  cards: CardRepository;
  orders: OrderRepository;
  rateLimits: RateLimitRepository;
  now: () => number;
  /** Chữ ký của thiệp nhóm (hiện cho người nhận). */
  signatures?: SignatureRepository;
}

export interface CreateCardInput {
  templateId: string;
  planId: string;
  data: unknown;
  images: Uint8Array[];
  /** File nhạc tự tải lên, chỉ dùng khi data.music = "tu-tai". */
  music?: Uint8Array | null;
  /** Lời nhắn giọng nói ghi ngay trên trình duyệt (không bắt buộc). */
  voice?: Uint8Array | null;
  /** Mã combo: có thì thiệp được kích hoạt ngay (gói Đặc biệt, 0đ), không cần thanh toán. */
  comboCode?: string | null;
}

export interface CreateCardResult {
  slug: string;
  orderCode: string;
  amount: number;
  editToken: string;
  orderExpiresAt: number;
  /** true khi thiệp đã kích hoạt ngay bằng mã combo. */
  paid: boolean;
}

/** Tình trạng một mã combo (hiện ở trang thanh toán, trang quản lý). */
export interface ComboStatus {
  total: number;
  used: number;
  remaining: number;
  paid: boolean;
}

const COMBO_EXTRA_CARDS = (PLANS.combo.cards as number) - 1; // thiệp đầu tiên là thiệp mua combo

/** Thông tin thiệp gửi xuống trình duyệt người nhận. Không chứa gì bí mật. */
export interface PublicCard {
  slug: string;
  template: string;
  plan: string;
  data: CardData;
  imageCount: number;
  /** Thiệp nhóm: lời chúc của từng thành viên. */
  signatures?: { name: string; message: string; sticker: string }[];
  /** Thiệp hẹn giờ chưa tới giờ: lúc được mở và giờ của server (để đếm ngược đúng dù đồng hồ máy sai). */
  waitUntil?: number;
  serverNow?: number;
}

/** Số chữ ký tối đa hiện trên một thiệp nhóm. */
export const SIGNATURES_SHOWN = 60;

export const isGroupTemplate = (templateId: string) => !!(TEMPLATES as Record<string, { group?: boolean }>)[templateId]?.group;

const MAX_ID_ATTEMPTS = 5;

export class CardService {
  deps: CardServiceDeps;
  constructor(deps: CardServiceDeps) {
    this.deps = deps;
  }

  /** Người tạo bấm "Lấy link thiệp": kiểm tra dữ liệu, lưu thiệp nháp và tạo đơn chờ thanh toán. */
  async createCard(input: CreateCardInput, clientIp: string): Promise<CreateCardResult> {
    const { cards, rateLimits, now } = this.deps;

    // 1. Kiểm tra toàn bộ dữ liệu trước khi ghi gì vào cơ sở dữ liệu.
    const usingCombo = !!input.comboCode;
    const plan = getPlan(usingCombo ? COMBO_CARD_PLAN : input.planId);
    const data = validateCardData(input.templateId, input.data);
    const images = validateImages(input.images, plan);
    // Chọn "nhạc của bạn" mà không gửi file thì quay về nhạc mặc định của mẫu; gửi file mà không chọn thì bỏ file.
    let music = null;
    if (data.music === CUSTOM_MUSIC_ID) {
      if (input.music?.length) music = validateAudio(input.music);
      else data.music = getReadyTemplate(input.templateId).defaultMusic;
    }
    // Lời nhắn giọng nói: cờ "voice" chỉ bật khi thật sự có file hợp lệ.
    const voice = input.voice?.length ? validateRecording(input.voice, 'audio') : null;
    data.voice = !!voice;
    const blocked = premiumBlock(plan, data);
    if (blocked) throw badRequest(blocked);

    // 2. Chống spam: tối đa N đơn mỗi giờ cho một IP.
    const createdAt = now();
    const count = await rateLimits.hit(`order:${clientIp}`, createdAt, RATE_LIMIT_ORDERS.windowMs);
    if (count > RATE_LIMIT_ORDERS.max) {
      throw tooMany('Bạn tạo nhiều đơn quá, đợi một lát rồi thử lại nhé.');
    }

    // 3. Dùng mã combo (nếu có): trừ một lượt ngay, lỗi về sau thì trả lại lượt.
    const comboHash = usingCombo ? await this.claimComboCredit(input.comboCode!, clientIp, createdAt) : null;

    // 4. Lưu thiệp + ảnh + đơn. Trùng mã ngẫu nhiên (rất hiếm) thì thử lại với mã mới.
    try {
      const editToken = newEditToken();
      const editTokenHash = await sha256Hex(editToken);
      // Mọi đơn đều lưu bản băm mã combo của mình; mã chỉ dùng được khi đơn là gói Combo và đã trả.
      const ownComboHash = await sha256Hex(await comboCodeFromEditToken(editToken));
      // Thiệp nhóm: lưu bản băm mã mời ký tên (mã thật chỉ người tạo tính ra được từ mã sửa).
      const inviteHash = isGroupTemplate(input.templateId) ? await sha256Hex(await inviteTokenFromEditToken(editToken)) : null;
      for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt++) {
        const slug = newSlug();
        const orderCode = newOrderCode();
        const result = await cards.createDraftWithOrder({
          card: { slug, template: input.templateId, dataJson: JSON.stringify(data), plan: plan.id, editTokenHash, createdAt, inviteHash },
          images,
          music,
          voice,
          order: {
            code: orderCode,
            plan: plan.id,
            amount: usingCombo ? 0 : plan.price,
            createdAt,
            comboCodeHash: usingCombo ? null : ownComboHash,
          },
          paid: usingCombo ? { paidAt: createdAt, expiresAt: computeExpiry(plan, createdAt) } : null,
        });
        if (result === 'conflict') continue;
        await this.cleanupQuietly(createdAt);
        return { slug, orderCode, amount: usingCombo ? 0 : plan.price, editToken, orderExpiresAt: createdAt + ORDER_TTL_MS, paid: usingCombo };
      }
      throw new AppError(503, 'Hệ thống đang bận, bạn thử lại sau ít phút nhé.');
    } catch (e) {
      if (comboHash) await this.deps.orders.refundComboCredit(comboHash);
      throw e;
    }
  }

  /** Kiểm tra mã combo và trừ một lượt. Trả về bản băm của mã. */
  private async claimComboCredit(raw: string, clientIp: string, now: number): Promise<string> {
    const hash = await this.findComboHash(raw, clientIp, now, `combo:${clientIp}`, COMBO_LIMIT);
    const combo = await this.deps.orders.findCombo(hash);
    if (!combo || combo.plan !== 'combo') throw badRequest('Mã combo không đúng. Bạn kiểm tra lại giúp mình nhé.');
    if (combo.status !== 'paid') throw badRequest('Combo này chưa được thanh toán.');
    if (!(await this.deps.orders.useComboCredit(hash, COMBO_EXTRA_CARDS))) throw badRequest('Mã combo này đã dùng hết lượt rồi.');
    return hash;
  }

  private async findComboHash(raw: string, clientIp: string, now: number, key: string, limit: { max: number; windowMs: number }) {
    const code = normalizeComboCode(raw);
    if (!COMBO_CODE_PATTERN.test(code)) throw badRequest('Mã combo gồm 10 ký tự, ví dụ ABCDE-FGH23.');
    // Đếm mọi lần nhập để không ai dò mã được.
    if ((await this.deps.rateLimits.hit(key, now, limit.windowMs)) > limit.max) {
      throw tooMany('Bạn nhập mã combo nhiều lần quá, đợi một lát nhé.');
    }
    return sha256Hex(code);
  }

  /** Mã combo còn bao nhiêu lượt. */
  async comboStatus(raw: unknown, clientIp: string): Promise<ComboStatus> {
    const hash = await this.findComboHash(String(raw ?? ''), clientIp, this.deps.now(), `combo-check:${clientIp}`, COMBO_CHECK_LIMIT);
    const combo = await this.deps.orders.findCombo(hash);
    if (!combo || combo.plan !== 'combo') throw badRequest('Mã combo không đúng.');
    const total = PLANS.combo.cards as number;
    const used = 1 + combo.used;
    return { total, used, remaining: Math.max(0, total - used), paid: combo.status === 'paid' };
  }

  /**
   * Dọn dẹp nhỏ mỗi lần có đơn mới (thay cho cron, không tốn thêm request):
   * xóa vài thiệp nháp quá 24 giờ và chuyển thiệp hết hạn sang "expired". Lỗi ở đây không làm hỏng đơn.
   */
  private async cleanupQuietly(now: number): Promise<void> {
    try {
      await this.deps.cards.cleanup({ draftBefore: now - CLEANUP.draftAgeMs, now, maxDrafts: CLEANUP.maxDrafts, maxExpired: CLEANUP.maxExpired });
    } catch (e) {
      console.error('[Dọn dẹp] lỗi:', e);
    }
  }

  /** Lấy thiệp còn hiệu lực theo slug. Thiệp quá hạn được chuyển sang "expired" ngay lúc này. */
  async findActiveCard(slug: string): Promise<CardRecord | null> {
    if (!SLUG_PATTERN.test(slug)) return null;
    const card = await this.deps.cards.findBySlug(slug);
    if (!card || card.status !== 'active') return null;
    if (isExpired(card.expiresAt, this.deps.now())) {
      await this.deps.cards.markExpired(card.id);
      return null;
    }
    return card;
  }

  /** Người nhận mở link thiệp: trả dữ liệu hiển thị và tăng lượt xem. */
  async openForViewer(slug: string, { countView = true }: { countView?: boolean } = {}): Promise<PublicCard | null> {
    const card = await this.findActiveCard(slug);
    if (!card) return null;
    const now = this.deps.now();
    const data = JSON.parse(card.dataJson) as CardData;
    // Hẹn giờ mở: chưa tới giờ thì chỉ gửi tên hai người để hiện đồng hồ đếm ngược, không gửi nội dung,
    // và không tính là đã mở.
    const waitUntil = data.openAt ? openAtMs(data.openAt) : null;
    if (waitUntil && now < waitUntil) {
      const teaser: CardData = {
        recipientName: data.recipientName,
        senderName: data.senderName,
        relationship: data.relationship,
        pronoun: data.pronoun,
        music: 'none',
        font: data.font,
        texts: {},
        openAt: data.openAt,
      };
      return { slug: card.slug, template: card.template, plan: card.plan, data: teaser, imageCount: 0, waitUntil, serverNow: now };
    }
    if (countView) await this.deps.cards.incrementViews(card.id, now);
    // Thư "Mở khi…": thư chưa tới ngày thì KHÔNG gửi nội dung xuống trình duyệt (khóa thật, không chỉnh giờ máy mà mở được).
    for (const key of lockedLetterKeys(card.template, data.texts, now)) data.texts[key] = '';
    const view: PublicCard = { slug: card.slug, template: card.template, plan: card.plan, data, imageCount: card.imageCount };
    if (isGroupTemplate(card.template) && this.deps.signatures) {
      const list = await this.deps.signatures.listForCard(card.id, SIGNATURES_SHOWN);
      view.signatures = list.map(({ name, message, sticker }) => ({ name, message, sticker }));
    }
    return view;
  }

  /** Thiệp hẹn giờ mở mà chưa tới giờ. */
  isWaiting(card: CardRecord): boolean {
    const at = openAtMs((JSON.parse(card.dataJson) as CardData).openAt ?? '');
    return at !== null && this.deps.now() < at;
  }

  /** Bài nhạc tự tải lên của thiệp đang hoạt động. */
  async getMusic(slug: string): Promise<StoredImage | null> {
    const card = await this.findActiveCard(slug);
    if (!card || this.isWaiting(card) || (JSON.parse(card.dataJson) as CardData).music !== CUSTOM_MUSIC_ID) return null;
    return this.deps.cards.getMusic(card.id);
  }

  /**
   * Lấy ảnh của thiệp. Thiệp đang hoạt động thì ai cũng xem được;
   * thiệp nháp chỉ xem được khi kèm đúng mã đơn đang chờ thanh toán.
   */
  async getImage(slug: string, idx: number, orderCode: string | null): Promise<StoredImage | null> {
    if (!SLUG_PATTERN.test(slug) || !Number.isInteger(idx) || idx < 0 || idx > 20) return null;

    let card = await this.findActiveCard(slug);
    if (card && this.isWaiting(card)) return null; // hẹn giờ mở: chưa tới giờ thì chưa cho xem ảnh
    if (!card && orderCode && ORDER_CODE_PATTERN.test(orderCode)) {
      const draft = await this.deps.cards.findBySlug(slug);
      const order = await this.deps.orders.findByCode(orderCode);
      if (draft?.status === 'draft' && order?.cardId === draft.id && order.status === 'pending') card = draft;
    }
    if (!card || idx >= card.imageCount) return null;
    return this.deps.cards.getImage(card.id, idx);
  }
}
