import { isUniqueViolation } from './d1-card-repository.ts';
import { activationStatements } from './d1-order-repository.ts';
import type { Activation, NewPayment, PaymentRepository } from './interfaces.ts';

export class D1PaymentRepository implements PaymentRepository {
  db: D1Database;
  constructor(db: D1Database) {
    this.db = db;
  }

  async record(p: NewPayment, activation: Activation | null): Promise<'recorded' | 'duplicate'> {
    const statements = [
      this.db
        .prepare(
          `INSERT INTO payments (sepay_id, order_code, amount, content, status, raw_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(p.sepayId, p.orderCode, p.amount, p.content, p.status, p.rawJson, p.createdAt),
    ];
    if (activation) {
      statements.push(...activationStatements(this.db, activation.orderCode, activation.paidAt, activation.expiresAt));
    }
    try {
      // Cùng một giao dịch: nếu sepay_id đã có (SePay gửi lại), không câu nào được thực hiện.
      await this.db.batch(statements);
      return 'recorded';
    } catch (e) {
      if (isUniqueViolation(e)) return 'duplicate';
      throw e;
    }
  }
}
