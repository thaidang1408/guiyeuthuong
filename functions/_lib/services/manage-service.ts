import { type CardData, validateCardData } from '../domain/card-data.ts';
import { badRequest } from '../domain/errors.ts';
import { getPlan, isExpired } from '../domain/plans.ts';
import type { CardRecord, CardRepository, OrderRepository, Signature, SignatureRepository } from '../repositories/interfaces.ts';
import { isGroupTemplate } from './card-service.ts';
import { badRequest as bad, notFound } from '../domain/errors.ts';
import { findCardWithToken } from './edit-token.ts';
import type { ResponseService, ResponseView } from './response-service.ts';
import { type ExtrasService, isMemoryBook } from './extras-service.ts';
import type { MemoryEntry } from '../repositories/interfaces.ts';

export interface ManageServiceDeps {
  cards: CardRepository;
  orders: OrderRepository;
  now: () => number;
  /** Câu trả lời, thư đáp lại của người nhận. */
  responses?: ResponseService;
  /** Chữ ký của thiệp nhóm. */
  signatures?: SignatureRepository;
  /** Video phản ứng, sổ tình yêu chung. */
  extras?: ExtrasService;
}

/** Thông tin trang quản lý của người tạo. */
export interface ManageView {
  slug: string;
  template: string;
  plan: string;
  status: CardRecord['status'];
  views: number;
  imageCount: number;
  createdAt: number;
  expiresAt: number | null;
  canEdit: boolean;
  data: CardData;
  /** Mã đơn đang chờ trả tiền (khi thiệp còn là bản nháp). */
  pendingOrderCode: string | null;
  /** Đơn đã thanh toán gần nhất: mã đơn + lúc trả tiền (để yêu cầu hoàn tiền trong thời gian cam kết). */
  paidOrder: { code: string; paidAt: number } | null;
  /** Câu trả lời và thư đáp lại của người nhận, mới nhất trước. */
  responses: ResponseView[];
  /** Phản ứng của người nhận: mở lúc nào, bấm "Có" sau bao nhiêu lần né… */
  reactions: { firstOpenedAt: number | null; lastOpenedAt: number | null; yesAt: number | null; noPresses: number | null; thinkMs: number | null };
  /** Thiệp nhóm: lời chúc của các thành viên (null với mẫu thường). */
  signatures: Signature[] | null;
  /** Thiệp nhóm: số chữ ký tối đa theo gói. */
  maxSignatures: number | null;
  /** Lúc nhận video phản ứng của người nhận (null = chưa có). */
  reactionAt: number | null;
  /** Sổ tình yêu chung: các trang hai người đã viết (null với mẫu khác). */
  memories: MemoryEntry[] | null;
}

export class ManageService {
  deps: ManageServiceDeps;
  constructor(deps: ManageServiceDeps) {
    this.deps = deps;
  }

  async getView(slug: unknown, token: unknown): Promise<ManageView> {
    const card = await this.withFreshStatus(await findCardWithToken(this.deps.cards, slug, token));
    const order = await this.deps.orders.findLatestByCard(card.id);
    return {
      slug: card.slug,
      template: card.template,
      plan: card.plan,
      status: card.status,
      views: card.views,
      imageCount: card.imageCount,
      createdAt: card.createdAt,
      expiresAt: card.expiresAt,
      canEdit: card.status === 'active' && getPlan(card.plan).canEditAfterSend,
      data: JSON.parse(card.dataJson) as CardData,
      pendingOrderCode: card.status === 'draft' && order && order.status === 'pending' ? order.code : null,
      // Thiệp tạo bằng mã combo có đơn 0đ: không có gì để hoàn.
      paidOrder: order && order.status === 'paid' && order.paidAt && order.amount > 0 ? { code: order.code, paidAt: order.paidAt } : null,
      responses: this.deps.responses ? await this.deps.responses.listForCard(card.id) : [],
      reactions: {
        firstOpenedAt: card.firstOpenedAt,
        lastOpenedAt: card.lastOpenedAt,
        yesAt: card.yesAt,
        noPresses: card.noPresses,
        thinkMs: card.thinkMs,
      },
      signatures: isGroupTemplate(card.template) && this.deps.signatures ? await this.deps.signatures.listForCard(card.id, 200) : null,
      maxSignatures: isGroupTemplate(card.template) ? (getPlan(card.plan).maxSignatures as number) : null,
      reactionAt: this.deps.extras ? await this.deps.extras.reactionReceivedAt(card.id) : null,
      memories: isMemoryBook(card.template) && this.deps.extras ? await this.deps.extras.memoriesForCard(card.id) : null,
    };
  }

  /** Sửa câu chữ sau khi gửi (chỉ gói Đặc biệt, thiệp đang hoạt động). Ảnh, nhạc giữ nguyên. */
  async updateTexts(slug: unknown, token: unknown, input: Record<string, unknown>): Promise<ManageView> {
    const card = await this.withFreshStatus(await findCardWithToken(this.deps.cards, slug, token));
    if (card.status !== 'active') throw badRequest('Thiệp không còn hoạt động nên không sửa được.');
    if (!getPlan(card.plan).canEditAfterSend) throw badRequest('Chỉ gói Đặc biệt mới sửa được lời nhắn sau khi gửi.');

    const current = JSON.parse(card.dataJson) as CardData;
    const next = validateCardData(card.template, {
      ...current,
      recipientName: input.recipientName,
      senderName: input.senderName,
      texts: input.texts,
    });
    await this.deps.cards.updateData(card.id, JSON.stringify(next));
    return this.getView(slug, token);
  }

  /** Người tổ chức thiệp nhóm xóa một lời chúc không phù hợp. */
  async deleteSignature(slug: unknown, token: unknown, id: unknown): Promise<ManageView> {
    const card = await findCardWithToken(this.deps.cards, slug, token);
    if (!isGroupTemplate(card.template) || !this.deps.signatures) throw bad('Thiệp này không phải thiệp nhóm.');
    if (typeof id !== 'number' || !(await this.deps.signatures.delete(card.id, id))) throw notFound('Lời chúc không tồn tại.');
    return this.getView(slug, token);
  }

  private async withFreshStatus(card: CardRecord): Promise<CardRecord> {
    if (card.status === 'active' && isExpired(card.expiresAt, this.deps.now())) {
      await this.deps.cards.markExpired(card.id);
      return { ...card, status: 'expired' };
    }
    return card;
  }
}
