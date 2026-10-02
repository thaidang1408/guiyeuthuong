// Cơ sở dữ liệu giả lập trong bộ nhớ, làm theo đúng "hợp đồng" ở repositories/interfaces.ts.
// Giúp test lớp dịch vụ mà không cần Cloudflare D1.
import type {
  ExtrasRepository,
  MediaKind,
  MemoryEntry,
  StoredMedia,
  Activation,
  AdminOrderRow,
  AdminRepository,
  CleanupOptions,
  CardRecord,
  CardRepository,
  NewDraft,
  NewPayment,
  OrderRecord,
  OrderRepository,
  PaymentRepository,
  RateLimitRepository,
  Signature,
  StoredImage,
} from '../../functions/_lib/repositories/interfaces.ts';

export const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9]);
export const DAY = 24 * 60 * 60 * 1000;

type StoredPayment = NewPayment & { id: number; resolvedAt: number | null };
type StoredReport = { id: number; cardId: number; reason: string; createdAt: number; resolvedAt: number | null };

export class MemoryDb implements ExtrasRepository, CardRepository, OrderRepository, PaymentRepository, RateLimitRepository, AdminRepository {
  cards: CardRecord[] = [];
  images = new Map<string, StoredImage>();
  music = new Map<number, StoredImage>();
  media = new Map<string, StoredMedia>();
  presence = new Map<number, Record<string, number>>();
  memories: (MemoryEntry & { cardId: number; image: StoredImage | null })[] = [];
  combos = new Map<string, { code: string; used: number }>();
  responses: { cardId: number; answerJson: string; createdAt: number }[] = [];
  orders: OrderRecord[] = [];
  payments: StoredPayment[] = [];
  reports: StoredReport[] = [];
  hits = new Map<string, number>();

  // --- CardRepository
  async createDraftWithOrder({ card, images, music, voice, order, paid }: NewDraft) {
    if (this.cards.some((c) => c.slug === card.slug) || this.orders.some((o) => o.code === order.code)) return 'conflict' as const;
    const id = this.cards.length + 1;
    this.cards.push({
      id,
      ...card,
      inviteHash: card.inviteHash ?? null,
      status: paid ? 'active' : 'draft',
      views: 0,
      imageCount: images.length,
      expiresAt: paid?.expiresAt ?? null,
      firstOpenedAt: null,
      lastOpenedAt: null,
      yesAt: null,
      noPresses: null,
      thinkMs: null,
    });
    images.forEach((img, idx) => this.images.set(`${id}/${idx}`, { mime: img.mime, data: img.bytes }));
    if (music) this.music.set(id, { mime: music.mime, data: music.bytes });
    if (voice) this.media.set(`${id}:voice`, { mime: voice.mime, data: voice.bytes, createdAt: card.createdAt });
    const { comboCodeHash, ...rest } = order;
    this.orders.push({ ...rest, cardId: id, status: paid ? 'paid' : 'pending', paidAt: paid?.paidAt ?? null });
    if (comboCodeHash) this.combos.set(comboCodeHash, { code: order.code, used: 0 });
    return 'ok' as const;
  }
  async findBySlug(slug: string) {
    return this.cards.find((c) => c.slug === slug) ?? null;
  }
  async updateData(cardId: number, dataJson: string) {
    this.card(cardId).dataJson = dataJson;
  }
  async markExpired(cardId: number) {
    this.card(cardId).status = 'expired';
    for (const key of [...this.images.keys()]) if (key.startsWith(`${cardId}/`)) this.images.delete(key);
    this.music.delete(cardId);
  }
  async incrementViews(cardId: number, now: number) {
    const c = this.card(cardId);
    c.views++;
    c.firstOpenedAt ??= now;
    c.lastOpenedAt = now;
  }
  async recordYes(cardId: number, at: number, noPresses: number, thinkMs: number) {
    const c = this.card(cardId);
    if (c.yesAt !== null) return false;
    Object.assign(c, { yesAt: at, noPresses, thinkMs });
    return true;
  }

  // --- SignatureRepository (dùng qua db.signatureRepo vì trùng tên hàm với các repository khác)
  signatures: (Signature & { cardId: number })[] = [];
  signatureRepo = {
    insert: async (cardId: number, sig: Omit<Signature, 'id'>) => {
      this.signatures.push({ ...sig, cardId, id: this.signatures.length + 1 });
    },
    countForCard: async (cardId: number) => this.signatures.filter((s) => s.cardId === cardId).length,
    listForCard: async (cardId: number, limit: number) =>
      this.signatures.filter((s) => s.cardId === cardId).slice(0, limit).map(({ cardId: _, ...s }) => s),
    delete: async (cardId: number, id: number) => {
      const before = this.signatures.length;
      this.signatures = this.signatures.filter((s) => !(s.cardId === cardId && s.id === id));
      return this.signatures.length < before;
    },
  };
  /** ResponseRepository (cũng trùng tên hàm insert với ReportRepository). */
  responseRepo = {
    insert: (cardId: number, json: string, at: number) => this.insertResponse(cardId, json, at),
    countForCard: (cardId: number) => this.countForCard(cardId),
    listForCard: (cardId: number, limit: number) => this.listForCard(cardId, limit),
  };
  async putMedia(cardId: number, kind: MediaKind, mime: string, bytes: Uint8Array, createdAt: number) {
    if (this.media.has(`${cardId}:${kind}`)) return false;
    this.media.set(`${cardId}:${kind}`, { mime, data: bytes, createdAt });
    return true;
  }
  async getMedia(cardId: number, kind: MediaKind) {
    return this.media.get(`${cardId}:${kind}`) ?? null;
  }
  async mediaCreatedAt(cardId: number, kind: MediaKind) {
    return this.media.get(`${cardId}:${kind}`)?.createdAt ?? null;
  }
  async touchPresence(cardId: number, side: string, now: number) {
    await this.setPresence(cardId, side, now);
    return { ...this.presence.get(cardId) };
  }
  async setPresence(cardId: number, side: string, at: number) {
    this.presence.set(cardId, { ...this.presence.get(cardId), [side]: at });
  }
  async insertMemory(cardId: number, entry: { author: string; text: string; image: StoredImage | null }, createdAt: number) {
    this.memories.push({ id: this.memories.length + 1, cardId, author: entry.author, text: entry.text, hasImage: !!entry.image, image: entry.image, createdAt });
  }
  async countMemories(cardId: number) {
    return this.memories.filter((m) => m.cardId === cardId).length;
  }
  async listMemories(cardId: number, limit: number) {
    return this.memories
      .filter((m) => m.cardId === cardId)
      .slice(0, limit)
      .map(({ id, author, text, hasImage, createdAt }) => ({ id, author, text, hasImage, createdAt }));
  }
  async getMemoryImage(cardId: number, id: number) {
    return this.memories.find((m) => m.cardId === cardId && m.id === id)?.image ?? null;
  }
  async deleteMemory(cardId: number, id: number) {
    const i = this.memories.findIndex((m) => m.cardId === cardId && m.id === id);
    if (i < 0) return false;
    this.memories.splice(i, 1);
    return true;
  }
  async getImage(cardId: number, idx: number) {
    return this.images.get(`${cardId}/${idx}`) ?? null;
  }
  async getMusic(cardId: number) {
    return this.music.get(cardId) ?? null;
  }
  async cleanup({ draftBefore, now, maxDrafts, maxExpired }: CleanupOptions) {
    const hasOpenPayment = (cardId: number) =>
      this.orders.some((o) => o.cardId === cardId && this.payments.some((p) => p.orderCode === o.code && p.resolvedAt === null));
    const drafts = this.cards
      .filter((c) => c.status === 'draft' && c.createdAt < draftBefore && !hasOpenPayment(c.id))
      .slice(0, maxDrafts);
    const expired = this.cards.filter((c) => c.status === 'active' && c.expiresAt !== null && c.expiresAt < now).slice(0, maxExpired);
    for (const c of drafts) {
      this.dropFiles(c.id);
      this.orders = this.orders.filter((o) => o.cardId !== c.id);
      this.cards = this.cards.filter((x) => x.id !== c.id);
    }
    for (const c of expired) {
      c.status = 'expired';
      this.dropFiles(c.id);
    }
    return { deletedDrafts: drafts.length, expired: expired.length };
  }
  async remove(cardId: number) {
    this.card(cardId).status = 'removed';
    this.dropFiles(cardId);
  }
  private dropFiles(cardId: number) {
    for (const key of [...this.images.keys()]) if (key.startsWith(`${cardId}/`)) this.images.delete(key);
    this.music.delete(cardId);
  }

  // --- OrderRepository
  async findByCode(code: string) {
    return this.orders.find((o) => o.code === code) ?? null;
  }
  async findLatestByCard(cardId: number) {
    return this.orders.filter((o) => o.cardId === cardId && o.plan !== 'nang-cap').at(-1) ?? null;
  }
  async createUpgradeOrder(o: { code: string; cardId: number; amount: number; createdAt: number }) {
    if (this.orders.some((x) => x.code === o.code)) return 'conflict' as const;
    this.orders.push({ code: o.code, cardId: o.cardId, plan: 'nang-cap', amount: o.amount, status: 'pending', createdAt: o.createdAt, paidAt: null });
    return 'ok' as const;
  }

  async changePlan(code: string, plan: string, amount: number) {
    const o = this.orders.find((x) => x.code === code && x.status === 'pending');
    if (!o) return false;
    Object.assign(o, { plan, amount });
    this.card(o.cardId).plan = plan;
    return true;
  }
  async markPaidAndActivate(code: string, paidAt: number, expiresAt: number) {
    const o = this.orders.find((x) => x.code === code && x.status === 'pending');
    if (!o) return false;
    Object.assign(o, { status: 'paid', paidAt });
    const c = this.card(o.cardId);
    if (c.status === 'draft') Object.assign(c, { status: 'active', expiresAt });
    if (o.plan === 'nang-cap' && c.status === 'active' && c.plan === 'co-ban') Object.assign(c, { plan: 'dac-biet', expiresAt: Math.max(c.expiresAt ?? 0, expiresAt) });
    return true;
  }

  async findCombo(hash: string) {
    const c = this.combos.get(hash);
    const o = c && this.orders.find((x) => x.code === c.code);
    return c && o ? { orderCode: o.code, plan: o.plan, status: o.status, used: c.used } : null;
  }
  async useComboCredit(hash: string, maxUses: number) {
    const combo = await this.findCombo(hash);
    if (!combo || combo.plan !== 'combo' || combo.status !== 'paid' || combo.used >= maxUses) return false;
    this.combos.get(hash)!.used++;
    return true;
  }
  async refundComboCredit(hash: string) {
    const c = this.combos.get(hash);
    if (c && c.used > 0) c.used--;
  }

  // --- ResponseRepository
  async countForCard(cardId: number) {
    return this.responses.filter((r) => r.cardId === cardId).length;
  }
  async listForCard(cardId: number, limit: number) {
    return this.responses.filter((r) => r.cardId === cardId).reverse().slice(0, limit);
  }
  async insertResponse(cardId: number, answerJson: string, createdAt: number) {
    this.responses.push({ cardId, answerJson, createdAt });
  }

  // --- PaymentRepository
  async record(payment: NewPayment, activation: Activation | null) {
    if (this.payments.some((p) => p.sepayId === payment.sepayId)) return 'duplicate' as const;
    this.payments.push({ ...payment, id: this.payments.length + 1, resolvedAt: null });
    if (activation) await this.markPaidAndActivate(activation.orderCode, activation.paidAt, activation.expiresAt);
    return 'recorded' as const;
  }

  // --- RateLimitRepository
  async hit(key: string) {
    const n = (this.hits.get(key) ?? 0) + 1;
    this.hits.set(key, n);
    return n;
  }

  // --- AdminRepository
  async revenueSince(since: number) {
    const paid = this.orders.filter((o) => o.status === 'paid' && o.amount > 0 && (o.paidAt ?? 0) >= since);
    return { orders: paid.length, total: paid.reduce((n, o) => n + o.amount, 0) };
  }
  private orderRow(o: OrderRecord): AdminOrderRow {
    const c = this.card(o.cardId);
    return {
      ...o,
      slug: c.slug,
      cardStatus: c.status,
      template: c.template,
      recipientName: JSON.parse(c.dataJson).recipientName ?? null,
      views: c.views,
      expiresAt: c.expiresAt,
    };
  }
  async paymentsSince(since: number) {
    return this.payments.filter((p) => p.createdAt >= since).length;
  }
  async latestOrders(limit: number) {
    return [...this.orders].reverse().slice(0, limit).map((o) => this.orderRow(o));
  }
  async findOrders(query: string) {
    return this.orders.filter((o) => o.code === query.toUpperCase() || this.card(o.cardId).slug === query.toLowerCase()).map((o) => this.orderRow(o));
  }
  async openPayments(limit: number) {
    return this.payments
      .filter((p) => p.status === 'needs_review' && p.resolvedAt === null)
      .slice(0, limit)
      .map((p) => {
        const o = this.orders.find((x) => x.code === p.orderCode);
        return { id: p.id, sepayId: p.sepayId, orderCode: p.orderCode, amount: p.amount, content: p.content, createdAt: p.createdAt, orderAmount: o?.amount ?? null, orderStatus: o?.status ?? null };
      });
  }
  async resolvePayment(id: number, at: number) {
    const p = this.payments.find((x) => x.id === id && x.resolvedAt === null);
    if (p) p.resolvedAt = at;
    return !!p;
  }
  async openReports(limit: number) {
    return this.reports
      .filter((r) => r.resolvedAt === null)
      .slice(0, limit)
      .map((r) => ({ id: r.id, reason: r.reason, createdAt: r.createdAt, slug: this.card(r.cardId).slug, cardStatus: this.card(r.cardId).status }));
  }
  async resolveReport(id: number, at: number) {
    const r = this.reports.find((x) => x.id === id && x.resolvedAt === null);
    if (r) r.resolvedAt = at;
    return !!r;
  }
  async resolveReportsOfCard(cardId: number, at: number) {
    for (const r of this.reports) if (r.cardId === cardId && r.resolvedAt === null) r.resolvedAt = at;
  }
  // ReportRepository
  async insert(cardId: number, reason: string, createdAt: number) {
    this.reports.push({ id: this.reports.length + 1, cardId, reason, createdAt, resolvedAt: null });
  }

  private card(id: number) {
    return this.cards.find((c) => c.id === id)!;
  }
}

/** Đồng hồ giả để test chuyện hết hạn. */
export function fakeClock(start = Date.UTC(2026, 9, 10)) {
  let t = start;
  return { now: () => t, tick: (ms: number) => (t += ms) };
}
