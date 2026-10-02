import { MUSIC_PART_BYTES } from '../config.ts';
import type { CardRecord, CardRepository, CleanupOptions, NewDraft, StoredImage } from './interfaces.ts';

interface CardRow {
  id: number;
  slug: string;
  template: string;
  data_json: string;
  plan: string;
  status: CardRecord['status'];
  edit_token_hash: string;
  views: number;
  image_count: number;
  created_at: number;
  expires_at: number | null;
  first_opened_at: number | null;
  last_opened_at: number | null;
  yes_at: number | null;
  no_presses: number | null;
  think_ms: number | null;
  invite_hash: string | null;
}

const toRecord = (r: CardRow): CardRecord => ({
  id: r.id,
  slug: r.slug,
  template: r.template,
  dataJson: r.data_json,
  plan: r.plan,
  status: r.status,
  editTokenHash: r.edit_token_hash,
  views: r.views,
  imageCount: r.image_count,
  createdAt: r.created_at,
  expiresAt: r.expires_at,
  firstOpenedAt: r.first_opened_at ?? null,
  lastOpenedAt: r.last_opened_at ?? null,
  yesAt: r.yes_at ?? null,
  noPresses: r.no_presses ?? null,
  thinkMs: r.think_ms ?? null,
  inviteHash: r.invite_hash ?? null,
});

export const isUniqueViolation = (e: unknown) =>
  String((e as Error)?.message ?? e).includes('UNIQUE constraint failed');

/** D1 có thể trả BLOB dạng ArrayBuffer hoặc mảng số tùy phiên bản. */
export function toBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (Array.isArray(value)) return Uint8Array.from(value);
  throw new Error('Unsupported BLOB type');
}

export class D1CardRepository implements CardRepository {
  db: D1Database;
  constructor(db: D1Database) {
    this.db = db;
  }

  async createDraftWithOrder({ card, images, music, voice, order, paid }: NewDraft): Promise<'ok' | 'conflict'> {
    const cardIdBySlug = '(SELECT id FROM cards WHERE slug = ?)';
    const statements = [
      this.db
        .prepare(
          `INSERT INTO cards (slug, template, data_json, plan, status, edit_token_hash, image_count, created_at, expires_at, invite_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          card.slug, card.template, card.dataJson, card.plan, paid ? 'active' : 'draft',
          card.editTokenHash, images.length, card.createdAt, paid?.expiresAt ?? null, card.inviteHash ?? null,
        ),
      ...images.map((img, idx) =>
        this.db
          .prepare(`INSERT INTO card_images (card_id, idx, mime, data) VALUES (${cardIdBySlug}, ?, ?, ?)`)
          .bind(card.slug, idx, img.mime, img.bytes),
      ),
      // Nhạc cắt thành nhiều phần vì một ô BLOB của D1 chỉ chứa được khoảng 2MB.
      ...(music ? splitParts(music.bytes) : []).map((bytes, part) =>
        this.db
          .prepare(`INSERT INTO card_music (card_id, part, mime, data) VALUES (${cardIdBySlug}, ?, ?, ?)`)
          .bind(card.slug, part, music!.mime, bytes),
      ),
      ...(voice ? splitParts(voice.bytes) : []).map((bytes, part) =>
        this.db
          .prepare(`INSERT INTO card_media (card_id, kind, part, mime, data, created_at) VALUES (${cardIdBySlug}, 'voice', ?, ?, ?, ?)`)
          .bind(card.slug, part, voice!.mime, bytes, card.createdAt),
      ),
      this.db
        .prepare(
          `INSERT INTO orders (code, card_id, plan, amount, status, created_at, paid_at, combo_code_hash)
           VALUES (?, ${cardIdBySlug}, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(order.code, card.slug, order.plan, order.amount, paid ? 'paid' : 'pending', order.createdAt, paid?.paidAt ?? null, order.comboCodeHash),
      // Thiệp trả trước (mã combo) cũng là một thiệp đã gửi.
      ...(paid ? [this.db.prepare(`UPDATE stats SET value = value + 1 WHERE key = 'cards_sent'`)] : []),
    ];
    try {
      await this.db.batch(statements); // batch = một giao dịch: lỗi một câu thì không lưu gì cả
      return 'ok';
    } catch (e) {
      if (isUniqueViolation(e)) return 'conflict';
      throw e;
    }
  }

  async findBySlug(slug: string): Promise<CardRecord | null> {
    const row = await this.db.prepare('SELECT * FROM cards WHERE slug = ?').bind(slug).first<CardRow>();
    return row ? toRecord(row) : null;
  }

  async updateData(cardId: number, dataJson: string): Promise<void> {
    await this.db.prepare('UPDATE cards SET data_json = ? WHERE id = ?').bind(dataJson, cardId).run();
  }

  async markExpired(cardId: number): Promise<void> {
    // Xóa ảnh để tiết kiệm dung lượng D1.
    await this.db.batch([
      this.db.prepare(`UPDATE cards SET status = 'expired' WHERE id = ? AND status = 'active'`).bind(cardId),
      this.db.prepare('DELETE FROM card_images WHERE card_id = ?').bind(cardId),
      this.db.prepare('DELETE FROM card_music WHERE card_id = ?').bind(cardId),
      ...EXTRA_TABLES.map((t) => this.db.prepare(`DELETE FROM ${t} WHERE card_id = ?`).bind(cardId)),
    ]);
  }

  async incrementViews(cardId: number, now: number): Promise<void> {
    await this.db
      .prepare('UPDATE cards SET views = views + 1, first_opened_at = COALESCE(first_opened_at, ?1), last_opened_at = ?1 WHERE id = ?2')
      .bind(now, cardId)
      .run();
  }

  async recordYes(cardId: number, at: number, noPresses: number, thinkMs: number): Promise<boolean> {
    const r = await this.db
      .prepare('UPDATE cards SET yes_at = ?, no_presses = ?, think_ms = ? WHERE id = ? AND yes_at IS NULL')
      .bind(at, noPresses, thinkMs, cardId)
      .run();
    return (r.meta.changes ?? 0) > 0;
  }

  async getImage(cardId: number, idx: number): Promise<StoredImage | null> {
    const row = await this.db
      .prepare('SELECT mime, data FROM card_images WHERE card_id = ? AND idx = ?')
      .bind(cardId, idx)
      .first<{ mime: string; data: unknown }>();
    return row ? { mime: row.mime, data: toBytes(row.data) } : null;
  }

  async getMusic(cardId: number): Promise<StoredImage | null> {
    const { results } = await this.db
      .prepare('SELECT mime, data FROM card_music WHERE card_id = ? ORDER BY part')
      .bind(cardId)
      .all<{ mime: string; data: unknown }>();
    if (!results.length) return null;
    const parts = results.map((r) => toBytes(r.data));
    const data = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let offset = 0;
    for (const p of parts) {
      data.set(p, offset);
      offset += p.length;
    }
    return { mime: results[0].mime, data };
  }

  async cleanup({ draftBefore, now, maxDrafts, maxExpired }: CleanupOptions) {
    const drafts = await this.db
      .prepare(
        `SELECT id FROM cards c WHERE status = 'draft' AND created_at < ?
           AND NOT EXISTS (
             SELECT 1 FROM orders o JOIN payments p ON p.order_code = o.code
             WHERE o.card_id = c.id AND p.resolved_at IS NULL
           )
         ORDER BY created_at LIMIT ?`,
      )
      .bind(draftBefore, maxDrafts)
      .all<{ id: number }>();
    const expired = await this.db
      .prepare(`SELECT id FROM cards WHERE status = 'active' AND expires_at < ? ORDER BY expires_at LIMIT ?`)
      .bind(now, maxExpired)
      .all<{ id: number }>();

    const draftIds = drafts.results.map((r) => r.id);
    const expiredIds = expired.results.map((r) => r.id);
    const inList = (ids: number[]) => `(${ids.map(() => '?').join(',')})`;
    const statements: D1PreparedStatement[] = [];
    if (draftIds.length) {
      for (const table of ['card_images', 'card_music', ...EXTRA_TABLES, 'orders']) {
        statements.push(this.db.prepare(`DELETE FROM ${table} WHERE card_id IN ${inList(draftIds)}`).bind(...draftIds));
      }
      statements.push(this.db.prepare(`DELETE FROM cards WHERE status = 'draft' AND id IN ${inList(draftIds)}`).bind(...draftIds));
    }
    if (expiredIds.length) {
      statements.push(
        this.db.prepare(`UPDATE cards SET status = 'expired' WHERE status = 'active' AND id IN ${inList(expiredIds)}`).bind(...expiredIds),
        this.db.prepare(`DELETE FROM card_images WHERE card_id IN ${inList(expiredIds)}`).bind(...expiredIds),
        this.db.prepare(`DELETE FROM card_music WHERE card_id IN ${inList(expiredIds)}`).bind(...expiredIds),
        ...EXTRA_TABLES.map((t) => this.db.prepare(`DELETE FROM ${t} WHERE card_id IN ${inList(expiredIds)}`).bind(...expiredIds)),
      );
    }
    if (statements.length) await this.db.batch(statements);
    return { deletedDrafts: draftIds.length, expired: expiredIds.length };
  }

  async remove(cardId: number): Promise<void> {
    await this.db.batch([
      this.db.prepare(`UPDATE cards SET status = 'removed' WHERE id = ?`).bind(cardId),
      this.db.prepare('DELETE FROM card_images WHERE card_id = ?').bind(cardId),
      this.db.prepare('DELETE FROM card_music WHERE card_id = ?').bind(cardId),
      ...EXTRA_TABLES.map((t) => this.db.prepare(`DELETE FROM ${t} WHERE card_id = ?`).bind(cardId)),
    ]);
  }
}

/** Bảng phụ (giọng nói, video phản ứng, mở cùng nhau, sổ tình yêu): xóa theo thiệp khi hết hạn/gỡ/dọn nháp. */
const EXTRA_TABLES = ['card_media', 'card_presence', 'card_memories'];

export function splitParts(bytes: Uint8Array): Uint8Array[] {
  const parts: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += MUSIC_PART_BYTES) parts.push(bytes.subarray(i, i + MUSIC_PART_BYTES));
  return parts;
}
