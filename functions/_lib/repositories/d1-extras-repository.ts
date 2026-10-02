import type { ExtrasRepository, MediaKind, MemoryEntry, StoredImage, StoredMedia } from './interfaces.ts';
import { isUniqueViolation, splitParts, toBytes } from './d1-card-repository.ts';

/** Giọng nói, video phản ứng, "mở cùng nhau", sổ tình yêu chung (bảng tạo ở migrations/0006). */
export class D1ExtrasRepository implements ExtrasRepository {
  db: D1Database;
  constructor(db: D1Database) {
    this.db = db;
  }

  async putMedia(cardId: number, kind: MediaKind, mime: string, bytes: Uint8Array, createdAt: number): Promise<boolean> {
    if ((await this.mediaCreatedAt(cardId, kind)) !== null) return false;
    try {
      await this.db.batch(
        splitParts(bytes).map((part, i) =>
          this.db
            .prepare('INSERT INTO card_media (card_id, kind, part, mime, data, created_at) VALUES (?, ?, ?, ?, ?, ?)')
            .bind(cardId, kind, i, mime, part, createdAt),
        ),
      );
      return true;
    } catch (e) {
      if (isUniqueViolation(e)) return false; // hai lần gửi cùng lúc
      throw e;
    }
  }

  async getMedia(cardId: number, kind: MediaKind): Promise<StoredMedia | null> {
    const { results } = await this.db
      .prepare('SELECT mime, data, created_at FROM card_media WHERE card_id = ? AND kind = ? ORDER BY part')
      .bind(cardId, kind)
      .all<{ mime: string; data: unknown; created_at: number }>();
    if (!results.length) return null;
    const parts = results.map((r) => toBytes(r.data));
    const data = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let offset = 0;
    for (const p of parts) {
      data.set(p, offset);
      offset += p.length;
    }
    return { mime: results[0].mime, data, createdAt: results[0].created_at };
  }

  async mediaCreatedAt(cardId: number, kind: MediaKind): Promise<number | null> {
    const row = await this.db
      .prepare('SELECT created_at FROM card_media WHERE card_id = ? AND kind = ? AND part = 0')
      .bind(cardId, kind)
      .first<{ created_at: number }>();
    return row?.created_at ?? null;
  }

  async touchPresence(cardId: number, side: string, now: number): Promise<Record<string, number>> {
    await this.setPresence(cardId, side, now);
    const { results } = await this.db
      .prepare('SELECT side, seen_at FROM card_presence WHERE card_id = ?')
      .bind(cardId)
      .all<{ side: string; seen_at: number }>();
    return Object.fromEntries(results.map((r) => [r.side, r.seen_at]));
  }

  async setPresence(cardId: number, side: string, at: number): Promise<void> {
    await this.db
      .prepare('INSERT INTO card_presence (card_id, side, seen_at) VALUES (?1, ?2, ?3) ON CONFLICT (card_id, side) DO UPDATE SET seen_at = ?3')
      .bind(cardId, side, at)
      .run();
  }

  async insertMemory(cardId: number, entry: { author: string; text: string; image: StoredImage | null }, createdAt: number): Promise<void> {
    await this.db
      .prepare('INSERT INTO card_memories (card_id, author, text, mime, image, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(cardId, entry.author, entry.text, entry.image?.mime ?? null, entry.image?.data ?? null, createdAt)
      .run();
  }

  async countMemories(cardId: number): Promise<number> {
    const r = await this.db.prepare('SELECT COUNT(*) AS n FROM card_memories WHERE card_id = ?').bind(cardId).first<{ n: number }>();
    return r?.n ?? 0;
  }

  async listMemories(cardId: number, limit: number): Promise<MemoryEntry[]> {
    const { results } = await this.db
      .prepare(
        'SELECT id, author, text, image IS NOT NULL AS has_image, created_at FROM card_memories WHERE card_id = ? ORDER BY created_at, id LIMIT ?',
      )
      .bind(cardId, limit)
      .all<{ id: number; author: string; text: string; has_image: number; created_at: number }>();
    return results.map((r) => ({ id: r.id, author: r.author, text: r.text, hasImage: !!r.has_image, createdAt: r.created_at }));
  }

  async getMemoryImage(cardId: number, id: number): Promise<StoredImage | null> {
    const row = await this.db
      .prepare('SELECT mime, image FROM card_memories WHERE card_id = ? AND id = ? AND image IS NOT NULL')
      .bind(cardId, id)
      .first<{ mime: string; image: unknown }>();
    return row ? { mime: row.mime, data: toBytes(row.image) } : null;
  }

  async deleteMemory(cardId: number, id: number): Promise<boolean> {
    const r = await this.db.prepare('DELETE FROM card_memories WHERE card_id = ? AND id = ?').bind(cardId, id).run();
    return (r.meta.changes ?? 0) > 0;
  }
}
