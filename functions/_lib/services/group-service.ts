import { INVITE_TOKEN_PATTERN } from '../../../public/js/shared/combo.js';
import { getPlan } from '../domain/plans.ts';
import { badRequest, notFound, tooMany } from '../domain/errors.ts';
import { SLUG_PATTERN, sha256Hex } from '../domain/ids.ts';
import { findBadWord } from '../domain/profanity.ts';
import { safeEqual } from '../domain/security.ts';
import type { CardData } from '../domain/card-data.ts';
import type { CardRecord, CardRepository, RateLimitRepository, SignatureRepository } from '../repositories/interfaces.ts';
import { isGroupTemplate } from './card-service.ts';

/** Nhãn dán người ký được chọn (chỉ nhận đúng các biểu tượng này). */
export const STICKERS = ['💐', '🌷', '🌸', '💖', '🎉', '🥰', '🌟', '🍀'];
export const SIGN_LIMITS = { name: 40, message: 300 };
const SIGN_RATE = { max: 30, windowMs: 60 * 60 * 1000 }; // nhiều người cùng văn phòng có thể chung một IP

export interface GroupServiceDeps {
  cards: CardRepository;
  signatures: SignatureRepository;
  rateLimits: RateLimitRepository;
  now: () => number;
}

export interface GroupInfo {
  recipientName: string;
  groupName: string;
  senderName: string;
  count: number;
  max: number;
  /** Tên những người đã ký (không lộ lời chúc, để dành bất ngờ cho người nhận). */
  names: string[];
  isActive: boolean;
}

function clean(value: unknown, label: string, max: number): string {
  const s = (typeof value === 'string' ? value : '').normalize('NFC').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').replace(/\n{3,}/g, '\n\n').trim();
  if (!s) throw badRequest(`Bạn chưa điền ${label}.`);
  if ([...s].length > max) throw badRequest(`${label[0].toUpperCase()}${label.slice(1)} dài quá (tối đa ${max} ký tự).`);
  const bad = findBadWord(s);
  if (bad) throw badRequest(`Có từ chưa phù hợp ("${bad}"), bạn sửa lại giúp mình nhé.`);
  return s;
}

/** Thiệp nhóm: thành viên mở link mời (/ky/<slug>#<mã>) để ký tên và viết lời chúc. */
export class GroupService {
  deps: GroupServiceDeps;
  constructor(deps: GroupServiceDeps) {
    this.deps = deps;
  }

  /** Kiểm tra link mời. Thiệp nháp (chưa trả tiền) vẫn ký được để người tổ chức gom lời chúc trước. */
  private async cardWithInvite(slug: unknown, token: unknown): Promise<CardRecord> {
    const fail = () => notFound('Link mời ký tên không đúng hoặc thiệp đã hết hạn.');
    if (typeof slug !== 'string' || !SLUG_PATTERN.test(slug) || typeof token !== 'string' || !INVITE_TOKEN_PATTERN.test(token)) throw fail();
    const card = await this.deps.cards.findBySlug(slug);
    if (!card || !card.inviteHash || !isGroupTemplate(card.template) || !['draft', 'active'].includes(card.status)) throw fail();
    if (!(await safeEqual(await sha256Hex(token), card.inviteHash))) throw fail();
    return card;
  }

  async info(slug: unknown, token: unknown): Promise<GroupInfo> {
    const card = await this.cardWithInvite(slug, token);
    const data = JSON.parse(card.dataJson) as CardData;
    const list = await this.deps.signatures.listForCard(card.id, 200);
    return {
      recipientName: data.recipientName,
      groupName: data.texts.groupName ?? '',
      senderName: data.senderName,
      count: list.length,
      max: getPlan(card.plan).maxSignatures as number,
      names: list.map((s) => s.name),
      isActive: card.status === 'active',
    };
  }

  async sign(slug: unknown, token: unknown, raw: unknown, clientIp: string): Promise<GroupInfo> {
    const card = await this.cardWithInvite(slug, token);
    const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const name = clean(input.name, 'tên', SIGN_LIMITS.name);
    const message = clean(input.message, 'lời chúc', SIGN_LIMITS.message);
    const sticker = typeof input.sticker === 'string' && STICKERS.includes(input.sticker) ? input.sticker : STICKERS[0];

    const now = this.deps.now();
    if ((await this.deps.rateLimits.hit(`sign:${clientIp}`, now, SIGN_RATE.windowMs)) > SIGN_RATE.max) {
      throw tooMany('Gửi nhiều quá, đợi một lát nhé.');
    }
    const max = getPlan(card.plan).maxSignatures as number;
    if ((await this.deps.signatures.countForCard(card.id)) >= max) {
      throw badRequest(`Thiệp đã đủ ${max} lời chúc rồi. Nhắn người tổ chức nếu bạn muốn gửi thêm nhé.`);
    }
    await this.deps.signatures.insert(card.id, { name, message, sticker, createdAt: now });
    return this.info(slug, token);
  }
}
