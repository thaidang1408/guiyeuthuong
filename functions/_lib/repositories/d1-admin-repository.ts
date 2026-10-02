import type { AdminOrderRow, AdminPaymentRow, AdminReportRow, AdminRepository } from './interfaces.ts';

const ORDER_COLUMNS = `o.code, o.plan, o.amount, o.status, o.created_at, o.paid_at,
  c.slug, c.status AS card_status, c.template, json_extract(c.data_json, '$.recipientName') AS recipient_name,
  c.views, c.expires_at`;

interface OrderRow {
  code: string;
  plan: string;
  amount: number;
  status: AdminOrderRow['status'];
  created_at: number;
  paid_at: number | null;
  slug: string;
  card_status: AdminOrderRow['cardStatus'];
  template: string;
  recipient_name: string | null;
  views: number;
  expires_at: number | null;
}

const toOrder = (r: OrderRow): AdminOrderRow => ({
  code: r.code,
  plan: r.plan,
  amount: r.amount,
  status: r.status,
  createdAt: r.created_at,
  paidAt: r.paid_at,
  slug: r.slug,
  cardStatus: r.card_status,
  template: r.template,
  recipientName: r.recipient_name,
  views: r.views,
  expiresAt: r.expires_at,
});

interface PaymentRow {
  id: number;
  sepay_id: string;
  order_code: string | null;
  amount: number;
  content: string | null;
  created_at: number;
  order_amount: number | null;
  order_status: AdminPaymentRow['orderStatus'];
}

interface ReportRow {
  id: number;
  reason: string;
  created_at: number;
  slug: string;
  card_status: AdminReportRow['cardStatus'];
}

export class D1AdminRepository implements AdminRepository {
  db: D1Database;
  constructor(db: D1Database) {
    this.db = db;
  }

  async revenueSince(since: number) {
    const r = await this.db
      .prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS total FROM orders WHERE status = 'paid' AND amount > 0 AND paid_at >= ?`)
      .bind(since)
      .first<{ n: number; total: number }>();
    return { orders: r?.n ?? 0, total: r?.total ?? 0 };
  }

  async paymentsSince(since: number) {
    const r = await this.db.prepare('SELECT COUNT(*) AS n FROM payments WHERE created_at >= ?').bind(since).first<{ n: number }>();
    return r?.n ?? 0;
  }

  async latestOrders(limit: number) {
    const { results } = await this.db
      .prepare(`SELECT ${ORDER_COLUMNS} FROM orders o JOIN cards c ON c.id = o.card_id ORDER BY o.created_at DESC LIMIT ?`)
      .bind(limit)
      .all<OrderRow>();
    return results.map(toOrder);
  }

  async findOrders(query: string) {
    const { results } = await this.db
      .prepare(
        `SELECT ${ORDER_COLUMNS} FROM orders o JOIN cards c ON c.id = o.card_id
         WHERE o.code = ? OR c.slug = ? ORDER BY o.created_at DESC LIMIT 10`,
      )
      .bind(query.toUpperCase(), query.toLowerCase())
      .all<OrderRow>();
    return results.map(toOrder);
  }

  async openPayments(limit: number) {
    const { results } = await this.db
      .prepare(
        `SELECT p.id, p.sepay_id, p.order_code, p.amount, p.content, p.created_at,
                o.amount AS order_amount, o.status AS order_status
         FROM payments p LEFT JOIN orders o ON o.code = p.order_code
         WHERE p.status = 'needs_review' AND p.resolved_at IS NULL
         ORDER BY p.created_at DESC LIMIT ?`,
      )
      .bind(limit)
      .all<PaymentRow>();
    return results.map((r) => ({
      id: r.id,
      sepayId: r.sepay_id,
      orderCode: r.order_code,
      amount: r.amount,
      content: r.content,
      createdAt: r.created_at,
      orderAmount: r.order_amount,
      orderStatus: r.order_status,
    }));
  }

  async resolvePayment(id: number, at: number) {
    const r = await this.db.prepare('UPDATE payments SET resolved_at = ? WHERE id = ? AND resolved_at IS NULL').bind(at, id).run();
    return (r.meta.changes ?? 0) > 0;
  }

  async openReports(limit: number) {
    const { results } = await this.db
      .prepare(
        `SELECT r.id, r.reason, r.created_at, c.slug, c.status AS card_status
         FROM reports r JOIN cards c ON c.id = r.card_id
         WHERE r.resolved_at IS NULL ORDER BY r.created_at DESC LIMIT ?`,
      )
      .bind(limit)
      .all<ReportRow>();
    return results.map((r) => ({ id: r.id, reason: r.reason, createdAt: r.created_at, slug: r.slug, cardStatus: r.card_status }));
  }

  async resolveReport(id: number, at: number) {
    const r = await this.db.prepare('UPDATE reports SET resolved_at = ? WHERE id = ? AND resolved_at IS NULL').bind(at, id).run();
    return (r.meta.changes ?? 0) > 0;
  }

  async resolveReportsOfCard(cardId: number, at: number) {
    await this.db.prepare('UPDATE reports SET resolved_at = ? WHERE card_id = ? AND resolved_at IS NULL').bind(at, cardId).run();
  }
}
