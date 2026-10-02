import { UPGRADE } from '../../../public/js/shared/plans.js';
import { isUniqueViolation } from './d1-card-repository.ts';
import type { ComboRecord, OrderRecord, OrderRepository } from './interfaces.ts';

interface OrderRow {
  code: string;
  card_id: number;
  plan: string;
  amount: number;
  status: OrderRecord['status'];
  created_at: number;
  paid_at: number | null;
}

const toRecord = (r: OrderRow): OrderRecord => ({
  code: r.code,
  cardId: r.card_id,
  plan: r.plan,
  amount: r.amount,
  status: r.status,
  createdAt: r.created_at,
  paidAt: r.paid_at,
});

/**
 * Hai câu lệnh "đánh dấu đơn đã trả + kích hoạt thiệp". Dùng chung cho kích hoạt thủ công
 * và cho webhook (ở đó chúng chạy cùng giao dịch với việc ghi nhận thanh toán).
 * Câu thứ hai chỉ có tác dụng khi câu thứ nhất vừa đổi đơn sang "paid" với đúng paid_at này.
 */
export function activationStatements(db: D1Database, code: string, paidAt: number, expiresAt: number) {
  return [
    db.prepare(`UPDATE orders SET status = 'paid', paid_at = ? WHERE code = ? AND status = 'pending'`).bind(paidAt, code),
    db
      .prepare(
        `UPDATE cards SET status = 'active', expires_at = ?
         WHERE id = (SELECT card_id FROM orders WHERE code = ? AND paid_at = ?) AND status = 'draft'`,
      )
      .bind(expiresAt, code, paidAt),
    // Đơn nâng cấp: thiệp Cơ bản đang hoạt động lên gói Đặc biệt, hạn mới tính từ lúc trả.
    db
      .prepare(
        `UPDATE cards SET plan = ?, expires_at = MAX(COALESCE(expires_at, 0), ?)
         WHERE id = (SELECT card_id FROM orders WHERE code = ? AND paid_at = ? AND plan = ?) AND status = 'active' AND plan = ?`,
      )
      .bind(UPGRADE.to, expiresAt, code, paidAt, UPGRADE.id, UPGRADE.from),
    // Đếm sẵn số thiệp đã gửi cho trang chủ (chỉ tăng khi chính lần này vừa đổi đơn sang "paid"; nâng cấp không tính).
    db
      .prepare(
        `UPDATE stats SET value = value + 1
         WHERE key = 'cards_sent' AND EXISTS (SELECT 1 FROM orders WHERE code = ? AND paid_at = ? AND status = 'paid' AND plan <> ?)`,
      )
      .bind(code, paidAt, UPGRADE.id),
  ];
}

export class D1OrderRepository implements OrderRepository {
  db: D1Database;
  constructor(db: D1Database) {
    this.db = db;
  }

  async findByCode(code: string): Promise<OrderRecord | null> {
    const r = await this.db.prepare('SELECT * FROM orders WHERE code = ?').bind(code).first<OrderRow>();
    return r ? toRecord(r) : null;
  }

  async findLatestByCard(cardId: number): Promise<OrderRecord | null> {
    const r = await this.db
      .prepare('SELECT * FROM orders WHERE card_id = ? AND plan <> ? ORDER BY created_at DESC LIMIT 1')
      .bind(cardId, UPGRADE.id)
      .first<OrderRow>();
    return r ? toRecord(r) : null;
  }

  async createUpgradeOrder(o: { code: string; cardId: number; amount: number; createdAt: number }): Promise<'ok' | 'conflict'> {
    try {
      await this.db
        .prepare(`INSERT INTO orders (code, card_id, plan, amount, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)`)
        .bind(o.code, o.cardId, UPGRADE.id, o.amount, o.createdAt)
        .run();
      return 'ok';
    } catch (e) {
      if (isUniqueViolation(e)) return 'conflict';
      throw e;
    }
  }

  async changePlan(code: string, plan: string, amount: number): Promise<boolean> {
    const res = await this.db
      .batch([
        this.db.prepare(`UPDATE orders SET plan = ?, amount = ? WHERE code = ? AND status = 'pending'`).bind(plan, amount, code),
        this.db
          .prepare(
            `UPDATE cards SET plan = ?
             WHERE id = (SELECT card_id FROM orders WHERE code = ? AND status = 'pending' AND plan = ?) AND status = 'draft'`,
          )
          .bind(plan, code, plan),
      ]);
    return (res[0].meta.changes ?? 0) > 0;
  }

  async markPaidAndActivate(code: string, paidAt: number, expiresAt: number): Promise<boolean> {
    const [orderResult] = await this.db.batch(activationStatements(this.db, code, paidAt, expiresAt));
    return (orderResult.meta.changes ?? 0) > 0;
  }

  async findCombo(comboCodeHash: string): Promise<ComboRecord | null> {
    const r = await this.db
      .prepare('SELECT code, plan, status, combo_used FROM orders WHERE combo_code_hash = ?')
      .bind(comboCodeHash)
      .first<{ code: string; plan: string; status: OrderRecord['status']; combo_used: number }>();
    return r ? { orderCode: r.code, plan: r.plan, status: r.status, used: r.combo_used } : null;
  }

  async useComboCredit(comboCodeHash: string, maxUses: number): Promise<boolean> {
    // Một câu lệnh duy nhất: hai người dùng chung mã cùng lúc cũng không vượt quá số lượt.
    const r = await this.db
      .prepare(
        `UPDATE orders SET combo_used = combo_used + 1
         WHERE combo_code_hash = ? AND plan = 'combo' AND status = 'paid' AND combo_used < ?`,
      )
      .bind(comboCodeHash, maxUses)
      .run();
    return (r.meta.changes ?? 0) > 0;
  }

  async refundComboCredit(comboCodeHash: string): Promise<void> {
    await this.db
      .prepare('UPDATE orders SET combo_used = combo_used - 1 WHERE combo_code_hash = ? AND combo_used > 0')
      .bind(comboCodeHash)
      .run();
  }
}
