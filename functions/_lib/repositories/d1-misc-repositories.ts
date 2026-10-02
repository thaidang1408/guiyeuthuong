import type {
  CardResponse,
  RateLimitRepository,
  ReportRepository,
  ResponseRepository,
  Signature,
  SignatureRepository,
  StatsRepository,
} from './interfaces.ts';

export class D1RateLimitRepository implements RateLimitRepository {
  db: D1Database;
  constructor(db: D1Database) {
    this.db = db;
  }

  async hit(key: string, now: number, windowMs: number): Promise<number> {
    // Cửa sổ cố định: quá windowMs kể từ lần đầu thì đếm lại từ 1.
    const row = await this.db
      .prepare(
        `INSERT INTO rate_limits (key, count, window_start) VALUES (?1, 1, ?2)
         ON CONFLICT (key) DO UPDATE SET
           count = CASE WHEN window_start <= ?2 - ?3 THEN 1 ELSE count + 1 END,
           window_start = CASE WHEN window_start <= ?2 - ?3 THEN ?2 ELSE window_start END
         RETURNING count`,
      )
      .bind(key, now, windowMs)
      .first<{ count: number }>();
    return row?.count ?? 1;
  }
}

export class D1ReportRepository implements ReportRepository {
  db: D1Database;
  constructor(db: D1Database) {
    this.db = db;
  }

  async insert(cardId: number, reason: string, createdAt: number): Promise<void> {
    await this.db
      .prepare('INSERT INTO reports (card_id, reason, created_at) VALUES (?, ?, ?)')
      .bind(cardId, reason, createdAt)
      .run();
  }
}

export class D1ResponseRepository implements ResponseRepository {
  db: D1Database;
  constructor(db: D1Database) {
    this.db = db;
  }

  async insert(cardId: number, answerJson: string, createdAt: number): Promise<void> {
    await this.db
      .prepare('INSERT INTO card_responses (card_id, answer_json, created_at) VALUES (?, ?, ?)')
      .bind(cardId, answerJson, createdAt)
      .run();
  }

  async countForCard(cardId: number): Promise<number> {
    const r = await this.db.prepare('SELECT COUNT(*) AS n FROM card_responses WHERE card_id = ?').bind(cardId).first<{ n: number }>();
    return r?.n ?? 0;
  }

  async listForCard(cardId: number, limit: number): Promise<CardResponse[]> {
    const { results } = await this.db
      .prepare('SELECT answer_json, created_at FROM card_responses WHERE card_id = ? ORDER BY created_at DESC LIMIT ?')
      .bind(cardId, limit)
      .all<{ answer_json: string; created_at: number }>();
    return results.map((r) => ({ answerJson: r.answer_json, createdAt: r.created_at }));
  }
}

export class D1SignatureRepository implements SignatureRepository {
  db: D1Database;
  constructor(db: D1Database) {
    this.db = db;
  }

  async insert(cardId: number, sig: Omit<Signature, 'id'>): Promise<void> {
    await this.db
      .prepare('INSERT INTO card_signatures (card_id, name, message, sticker, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(cardId, sig.name, sig.message, sig.sticker, sig.createdAt)
      .run();
  }

  async countForCard(cardId: number): Promise<number> {
    const r = await this.db.prepare('SELECT COUNT(*) AS n FROM card_signatures WHERE card_id = ?').bind(cardId).first<{ n: number }>();
    return r?.n ?? 0;
  }

  async listForCard(cardId: number, limit: number): Promise<Signature[]> {
    const { results } = await this.db
      .prepare('SELECT id, name, message, sticker, created_at FROM card_signatures WHERE card_id = ? ORDER BY created_at LIMIT ?')
      .bind(cardId, limit)
      .all<{ id: number; name: string; message: string; sticker: string; created_at: number }>();
    return results.map((r) => ({ id: r.id, name: r.name, message: r.message, sticker: r.sticker, createdAt: r.created_at }));
  }

  async delete(cardId: number, id: number): Promise<boolean> {
    const r = await this.db.prepare('DELETE FROM card_signatures WHERE card_id = ? AND id = ?').bind(cardId, id).run();
    return (r.meta.changes ?? 0) > 0;
  }
}

export class D1StatsRepository implements StatsRepository {
  db: D1Database;
  constructor(db: D1Database) {
    this.db = db;
  }

  async get(key: string): Promise<number> {
    const r = await this.db.prepare('SELECT value FROM stats WHERE key = ?').bind(key).first<{ value: number }>();
    return r?.value ?? 0;
  }
}
