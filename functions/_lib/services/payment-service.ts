import { AppError } from '../domain/errors.ts';
import { computeExpiry, planForOrder } from '../domain/plans.ts';
import { safeEqual } from '../domain/security.ts';
import { parseSepayTransaction } from '../domain/sepay.ts';
import type { Activation, OrderRepository, PaymentRepository, PaymentStatus } from '../repositories/interfaces.ts';

export interface PaymentServiceDeps {
  payments: PaymentRepository;
  orders: OrderRepository;
  now: () => number;
  /** SEPAY_WEBHOOK_KEY. Không đặt thì mọi webhook bị từ chối. */
  webhookKey: string | undefined;
}

export type WebhookOutcome = 'ignored' | 'duplicate' | PaymentStatus;

export class PaymentService {
  deps: PaymentServiceDeps;
  constructor(deps: PaymentServiceDeps) {
    this.deps = deps;
  }

  /**
   * Xử lý webhook SePay báo có giao dịch.
   * - Sai khóa → lỗi 401.
   * - Tiền ra (transferType khác "in") → bỏ qua.
   * - Giao dịch đã ghi trước đó → bỏ qua (SePay có thể gửi lại).
   * - Khớp mã đơn và đủ tiền → "matched": đánh dấu đơn đã trả, kích hoạt thiệp.
   * - Còn lại (thiếu tiền, không có mã, đơn đã trả rồi…) → "needs_review" để chủ dự án xử lý tay.
   */
  async handleWebhook(authorization: string | null, body: unknown): Promise<WebhookOutcome> {
    await this.assertAuthorized(authorization);
    return this.processTransaction(body);
  }

  /** Header Authorization phải đúng bằng "Apikey <SEPAY_WEBHOOK_KEY>", sai thì lỗi 401. */
  async assertAuthorized(authorization: string | null): Promise<void> {
    const { webhookKey } = this.deps;
    if (!webhookKey) {
      console.error('SEPAY_WEBHOOK_KEY chưa được đặt — từ chối webhook.');
      throw new AppError(401, 'Unauthorized');
    }
    if (!(await safeEqual(authorization ?? '', `Apikey ${webhookKey}`))) {
      throw new AppError(401, 'Unauthorized');
    }
  }

  /** Ghi nhận một giao dịch đã qua kiểm tra khóa. */
  async processTransaction(body: unknown): Promise<WebhookOutcome> {
    const tx = parseSepayTransaction(body);
    if (tx.transferType !== 'in') return 'ignored';

    const now = this.deps.now();
    const order = tx.orderCode ? await this.deps.orders.findByCode(tx.orderCode) : null;

    // Chấp nhận cả đơn đã quá 30 phút: khách chuyển muộn vẫn nhận được thiệp, miễn là chưa trả lần nào.
    let activation: Activation | null = null;
    if (order && order.status !== 'paid' && tx.transferAmount >= order.amount) {
      activation = { orderCode: order.code, paidAt: now, expiresAt: computeExpiry(planForOrder(order.plan), now) };
    }
    const status: PaymentStatus = activation ? 'matched' : 'needs_review';

    const result = await this.deps.payments.record(
      {
        sepayId: tx.id,
        orderCode: tx.orderCode,
        amount: tx.transferAmount,
        content: tx.content ?? tx.code,
        status,
        rawJson: JSON.stringify(body).slice(0, 10_000),
        createdAt: now,
      },
      activation,
    );
    return result === 'duplicate' ? 'duplicate' : status;
  }
}
