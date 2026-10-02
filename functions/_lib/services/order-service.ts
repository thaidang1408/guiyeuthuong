import { ORDER_TTL_MS, PAYMENT_QR_BASE, RATE_LIMIT_ORDERS } from '../config.ts';
import { badRequest, notFound, tooMany } from '../domain/errors.ts';
import { ORDER_CODE_PATTERN, newOrderCode } from '../domain/ids.ts';
import { computeExpiry, getPlan, planForOrder } from '../domain/plans.ts';
import type { CardRepository, OrderRecord, OrderRepository, RateLimitRepository } from '../repositories/interfaces.ts';
import { findCardWithToken } from './edit-token.ts';
import { UPGRADE, premiumBlock, upgradePrice } from '../../../public/js/shared/plans.js';

export interface PaymentAccount {
  acc: string;
  bank: string;
}

export interface OrderServiceDeps {
  orders: OrderRepository;
  cards: CardRepository;
  now: () => number;
  /** Tài khoản nhận tiền (từ biến môi trường). Thiếu thì trang thanh toán báo lỗi cấu hình. */
  account: PaymentAccount | null;
  /** Bật nút "Giả lập tiền về" trên trang thanh toán (chỉ khi chạy ở máy). */
  devSimulate?: boolean;
  /** Giới hạn tạo đơn nâng cấp theo IP (dùng chung hạn mức với đơn mới). */
  rateLimits?: RateLimitRepository;
}

/** Thông tin đơn gửi xuống trang thanh toán. Không chứa slug hay mã sửa. */
export interface OrderView {
  code: string;
  status: 'pending' | 'paid' | 'expired';
  plan: string;
  amount: number;
  expiresAt: number;
  payment: { acc: string; bank: string; content: string; qrUrl: string } | null;
  devSimulate: boolean;
}

export function buildQrUrl(account: PaymentAccount, amount: number, content: string): string {
  const params = new URLSearchParams({ acc: account.acc, bank: account.bank, amount: String(amount), des: content, template: 'compact' });
  return `${PAYMENT_QR_BASE}?${params}`;
}

export class OrderService {
  deps: OrderServiceDeps;
  constructor(deps: OrderServiceDeps) {
    this.deps = deps;
  }

  /** Đơn chưa trả mà quá 30 phút thì coi là hết hạn (không cần cron, tính lúc đọc). */
  statusOf(order: OrderRecord): OrderView['status'] {
    if (order.status === 'paid') return 'paid';
    if (order.status === 'expired' || this.deps.now() > order.createdAt + ORDER_TTL_MS) return 'expired';
    return 'pending';
  }

  toView(order: OrderRecord): OrderView {
    const status = this.statusOf(order);
    const { account } = this.deps;
    return {
      code: order.code,
      status,
      plan: order.plan,
      amount: order.amount,
      expiresAt: order.createdAt + ORDER_TTL_MS,
      payment:
        status === 'pending' && account
          ? { acc: account.acc, bank: account.bank, content: order.code, qrUrl: buildQrUrl(account, order.amount, order.code) }
          : null,
      devSimulate: this.deps.devSimulate === true,
    };
  }

  async getStatus(code: string): Promise<OrderView> {
    const order = ORDER_CODE_PATTERN.test(code) ? await this.deps.orders.findByCode(code) : null;
    if (!order) throw notFound('Không tìm thấy đơn.');
    return this.toView(order);
  }

  /** Người tạo đổi gói ở trang thanh toán (cần đúng mã sửa thiệp). */
  async changePlan(code: string, planId: unknown, slug: unknown, token: unknown): Promise<OrderView> {
    const plan = getPlan(planId);
    const card = await findCardWithToken(this.deps.cards, slug, token);
    const order = ORDER_CODE_PATTERN.test(code) ? await this.deps.orders.findByCode(code) : null;
    if (!order || order.cardId !== card.id) throw notFound('Không tìm thấy đơn.');
    if (this.statusOf(order) !== 'pending') throw badRequest('Đơn này không còn đổi gói được.');
    if (order.plan === UPGRADE.id) throw badRequest('Đơn nâng cấp không đổi gói được.');
    if (card.imageCount > plan.maxImages) {
      throw badRequest(`Thiệp có ${card.imageCount} ảnh, gói ${plan.name} chỉ cho tối đa ${plan.maxImages} ảnh.`);
    }
    const blocked = premiumBlock(plan, JSON.parse(card.dataJson));
    if (blocked) throw badRequest(blocked);
    if (order.plan !== plan.id) await this.deps.orders.changePlan(code, plan.id, plan.price);
    return this.getStatus(code);
  }

  /**
   * Nâng cấp sau khi gửi: thiệp Cơ bản đang hoạt động → tạo đơn trả phần chênh lệch.
   * Tiền về (webhook) thì thiệp lên gói Đặc biệt, link dùng thêm 365 ngày.
   */
  async createUpgrade(slug: unknown, token: unknown, clientIp: string): Promise<OrderView> {
    const card = await findCardWithToken(this.deps.cards, slug, token);
    const now = this.deps.now();
    if (card.status !== 'active' || (card.expiresAt !== null && card.expiresAt <= now)) {
      throw badRequest('Chỉ nâng cấp được thiệp đang hoạt động.');
    }
    if (card.plan !== UPGRADE.from) throw badRequest('Thiệp này đã là gói Đặc biệt rồi.');
    if (this.deps.rateLimits) {
      const count = await this.deps.rateLimits.hit(`order:${clientIp}`, now, RATE_LIMIT_ORDERS.windowMs);
      if (count > RATE_LIMIT_ORDERS.max) throw tooMany('Bạn tạo nhiều đơn quá, đợi một lát rồi thử lại nhé.');
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newOrderCode();
      const result = await this.deps.orders.createUpgradeOrder({ code, cardId: card.id, amount: upgradePrice(), createdAt: now });
      if (result === 'ok') return this.getStatus(code);
    }
    throw new Error('Không tạo được mã đơn nâng cấp');
  }

  /** Kích hoạt đơn bằng tay (dùng cho trang quản trị ở giai đoạn 4). */
  async activateOrder(code: string): Promise<boolean> {
    const order = await this.deps.orders.findByCode(code);
    if (!order || order.status === 'paid') return false;
    const paidAt = this.deps.now();
    return this.deps.orders.markPaidAndActivate(code, paidAt, computeExpiry(planForOrder(order.plan), paidAt));
  }
}
