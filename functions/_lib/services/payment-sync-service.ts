import { SEPAY_SYNC } from '../config.ts';
import { extractOrderCode } from '../domain/order-code.ts';
import type { BankTransactionFeed, RateLimitRepository } from '../repositories/interfaces.ts';
import type { PaymentService } from './payment-service.ts';

export interface PaymentSyncDeps {
  /** null = chưa cấu hình SEPAY_API_TOKEN → tắt đối soát. */
  feed: BankTransactionFeed | null;
  payments: PaymentService;
  rateLimits: RateLimitRepository;
  now: () => number;
}

/**
 * Đối soát dự phòng: khi trang thanh toán đang chờ, hỏi SePay xem có tiền mới về không.
 * Dùng khi webhook không tới (cấu hình sai, mất mạng…). Mọi giao dịch đi qua đúng đường xử lý
 * của webhook và được chống trùng theo mã giao dịch SePay, nên không bao giờ bị tính hai lần.
 */
export class PaymentSyncService {
  deps: PaymentSyncDeps;
  constructor(deps: PaymentSyncDeps) {
    this.deps = deps;
  }

  /** Trả về true nếu vừa đối soát (có thể có đơn mới được kích hoạt). */
  async syncIfDue(): Promise<boolean> {
    const { feed, payments, rateLimits, now } = this.deps;
    if (!feed) return false;
    // Cả hệ thống chỉ hỏi SePay tối đa 1 lần mỗi 10 giây, dù có bao nhiêu trang đang chờ.
    if ((await rateLimits.hit('sepay-sync', now(), SEPAY_SYNC.intervalMs)) > 1) return false;

    let transactions;
    try {
      transactions = await feed.listRecent(SEPAY_SYNC.limit);
    } catch (e) {
      console.error('[SePay] Đối soát qua API thất bại:', (e as Error).message);
      return false;
    }

    let handled = 0;
    for (const t of transactions) {
      // Chỉ xét tiền vào có mã đơn: tiền cá nhân khác trong tài khoản không bị đụng tới.
      if (t.amountIn <= 0 || !extractOrderCode(t.code, t.content)) continue;
      const outcome = await payments.processTransaction({
        id: t.id,
        transferType: 'in',
        transferAmount: t.amountIn,
        code: t.code,
        content: t.content,
        transactionDate: t.transactionDate,
        source: 'sepay-api',
      });
      if (outcome !== 'duplicate') {
        handled++;
        console.log(`[SePay] Đối soát API: giao dịch #${t.id} "${t.content}" → ${outcome}`);
      }
    }
    return handled > 0;
  }
}
