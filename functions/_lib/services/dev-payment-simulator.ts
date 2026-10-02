import { notFound } from '../domain/errors.ts';
import { ORDER_CODE_PATTERN } from '../domain/ids.ts';
import type { OrderRepository } from '../repositories/interfaces.ts';
import type { PaymentService, WebhookOutcome } from './payment-service.ts';

export type SimulateMode = 'du' | 'thieu';

/**
 * CHỈ DÙNG KHI THỬ Ở MÁY: tạo một giao dịch giống hệt SePay gửi, rồi đưa qua
 * đúng đường xử lý của webhook thật (bỏ qua bước kiểm tra khóa).
 */
export class DevPaymentSimulator {
  orders: OrderRepository;
  payments: PaymentService;
  constructor(orders: OrderRepository, payments: PaymentService) {
    this.orders = orders;
    this.payments = payments;
  }

  async simulate(code: string, mode: SimulateMode): Promise<{ amount: number; outcome: WebhookOutcome }> {
    const order = ORDER_CODE_PATTERN.test(code) ? await this.orders.findByCode(code) : null;
    if (!order) throw notFound('Không tìm thấy đơn.');
    const amount = mode === 'thieu' ? Math.max(0, order.amount - 5000) : order.amount;
    const id = `gia-lap-${Date.now()}`;
    const outcome = await this.payments.processTransaction({
      id,
      gateway: 'GIA-LAP',
      transactionDate: new Date().toISOString(),
      accountNumber: 'GIA-LAP',
      code: null,
      content: `GIA LAP chuyen tien ${code}`,
      transferType: 'in',
      transferAmount: amount,
      referenceCode: id,
      description: 'Giao dịch giả lập từ nút thử nghiệm',
    });
    return { amount, outcome };
  }
}
