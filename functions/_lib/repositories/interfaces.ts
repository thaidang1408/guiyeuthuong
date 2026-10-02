// "Hợp đồng" của lớp dữ liệu. Lớp dịch vụ chỉ biết các interface này,
// nên khi test có thể thay D1 bằng bản giả lập trong bộ nhớ.
import type { AudioUpload } from '../domain/audio.ts';
import type { ImageUpload } from '../domain/images.ts';

export type CardStatus = 'draft' | 'active' | 'expired' | 'removed';
export type OrderStatus = 'pending' | 'paid' | 'expired';

export interface CardRecord {
  id: number;
  slug: string;
  template: string;
  dataJson: string;
  plan: string;
  status: CardStatus;
  editTokenHash: string;
  views: number;
  imageCount: number;
  createdAt: number;
  expiresAt: number | null;
  firstOpenedAt: number | null;
  lastOpenedAt: number | null;
  /** Lúc người nhận bấm "Có"/"Tha"/hoàn thành tương tác chính (lần đầu). */
  yesAt: number | null;
  noPresses: number | null;
  thinkMs: number | null;
  /** Bản băm mã mời ký tên (thiệp nhóm). */
  inviteHash: string | null;
}

export interface OrderRecord {
  code: string;
  cardId: number;
  plan: string;
  amount: number;
  status: OrderStatus;
  createdAt: number;
  paidAt: number | null;
}

export interface NewDraft {
  card: { slug: string; template: string; dataJson: string; plan: string; editTokenHash: string; createdAt: number; inviteHash?: string | null };
  images: ImageUpload[];
  /** Bài nhạc tự tải lên (nếu có). */
  music: AudioUpload | null;
  /** Lời nhắn giọng nói (nếu có). */
  voice?: AudioUpload | null;
  order: { code: string; plan: string; amount: number; createdAt: number; comboCodeHash: string | null };
  /** Có giá trị khi thiệp đã được trả trước (dùng mã combo): lưu thẳng thiệp "active" và đơn "paid". */
  paid?: { paidAt: number; expiresAt: number } | null;
}

/** Đơn mua combo, tìm theo bản băm mã combo. */
export interface ComboRecord {
  orderCode: string;
  plan: string;
  status: OrderStatus;
  used: number;
}

export interface StoredImage {
  mime: string;
  data: Uint8Array;
}

export interface CardRepository {
  /** Lưu thiệp nháp + ảnh + đơn trong một giao dịch. Trả về "conflict" nếu trùng slug/mã đơn. */
  createDraftWithOrder(draft: NewDraft): Promise<'ok' | 'conflict'>;
  findBySlug(slug: string): Promise<CardRecord | null>;
  updateData(cardId: number, dataJson: string): Promise<void>;
  markExpired(cardId: number): Promise<void>;
  /** Tăng lượt xem và ghi lại lúc mở (lần đầu, lần gần nhất). */
  incrementViews(cardId: number, now: number): Promise<void>;
  /** Ghi phản ứng chính của người nhận (chỉ lần đầu). Trả false nếu đã có. */
  recordYes(cardId: number, at: number, noPresses: number, thinkMs: number): Promise<boolean>;
  getImage(cardId: number, idx: number): Promise<StoredImage | null>;
  /** Bài nhạc tự tải lên, đã ghép đủ các phần. */
  getMusic(cardId: number): Promise<StoredImage | null>;
  /**
   * Dọn dẹp (không dùng cron, gọi mỗi lần có đơn mới):
   * xóa tối đa `maxDrafts` thiệp nháp tạo trước `draftBefore` (kèm ảnh, nhạc, đơn) — trừ thiệp có
   * giao dịch "cần xem" chưa xử lý; chuyển tối đa `maxExpired` thiệp quá hạn sang "expired" và xóa ảnh, nhạc.
   */
  cleanup(opts: CleanupOptions): Promise<{ deletedDrafts: number; expired: number }>;
  /** Gỡ thiệp vi phạm: chuyển "removed", xóa ảnh và nhạc. */
  remove(cardId: number): Promise<void>;
}

export interface CleanupOptions {
  draftBefore: number;
  now: number;
  maxDrafts: number;
  maxExpired: number;
}

export interface OrderRepository {
  findByCode(code: string): Promise<OrderRecord | null>;
  /** Đơn mua gần nhất của một thiệp (không tính đơn nâng cấp) — để trang quản lý dẫn về trang thanh toán. */
  findLatestByCard(cardId: number): Promise<OrderRecord | null>;
  /** Tạo đơn nâng cấp (chờ thanh toán) cho thiệp đang hoạt động. "conflict" nếu trùng mã đơn. */
  createUpgradeOrder(order: { code: string; cardId: number; amount: number; createdAt: number }): Promise<'ok' | 'conflict'>;
  /** Đổi gói của đơn còn chờ thanh toán. Trả false nếu đơn không còn "pending". */
  changePlan(code: string, plan: string, amount: number): Promise<boolean>;
  /** Đánh dấu đơn đã trả và kích hoạt thiệp (một giao dịch). Trả false nếu đơn không còn "pending". */
  markPaidAndActivate(code: string, paidAt: number, expiresAt: number): Promise<boolean>;
  findCombo(comboCodeHash: string): Promise<ComboRecord | null>;
  /** Trừ một lượt combo (chỉ khi đơn combo đã trả và còn lượt). Trả false nếu không trừ được. */
  useComboCredit(comboCodeHash: string, maxUses: number): Promise<boolean>;
  /** Trả lại lượt vừa trừ khi tạo thiệp bị lỗi. */
  refundComboCredit(comboCodeHash: string): Promise<void>;
}

/** Câu trả lời của người nhận (mẫu "Đi chơi"). */
export interface CardResponse {
  answerJson: string;
  createdAt: number;
}

export interface ResponseRepository {
  insert(cardId: number, answerJson: string, createdAt: number): Promise<void>;
  countForCard(cardId: number): Promise<number>;
  listForCard(cardId: number, limit: number): Promise<CardResponse[]>;
}

export type PaymentStatus = 'matched' | 'needs_review';

export interface NewPayment {
  sepayId: string;
  orderCode: string | null;
  amount: number;
  content: string | null;
  status: PaymentStatus;
  rawJson: string;
  createdAt: number;
}

/** Kích hoạt kèm theo khi ghi nhận giao dịch khớp đơn. */
export interface Activation {
  orderCode: string;
  paidAt: number;
  expiresAt: number;
}

export interface PaymentRepository {
  /**
   * Ghi nhận giao dịch (và kích hoạt thiệp nếu có) trong MỘT giao dịch cơ sở dữ liệu.
   * Trả "duplicate" nếu mã giao dịch SePay đã được ghi trước đó — khi ấy không thay đổi gì.
   */
  record(payment: NewPayment, activation: Activation | null): Promise<'recorded' | 'duplicate'>;
}

/** Một giao dịch lấy từ API của SePay (danh sách giao dịch). */
export interface BankTransaction {
  id: string;
  amountIn: number;
  content: string | null;
  code: string | null;
  transactionDate: string;
}

export interface BankTransactionFeed {
  /** Các giao dịch gần nhất, mới nhất trước. */
  listRecent(limit: number): Promise<BankTransaction[]>;
}

export interface RateLimitRepository {
  /** Ghi nhận một lượt và trả về số lượt trong cửa sổ thời gian hiện tại. */
  hit(key: string, now: number, windowMs: number): Promise<number>;
}

export interface ReportRepository {
  insert(cardId: number, reason: string, createdAt: number): Promise<void>;
}

// --- Trang quản trị

export interface AdminOrderRow {
  code: string;
  plan: string;
  amount: number;
  status: OrderStatus;
  createdAt: number;
  paidAt: number | null;
  slug: string;
  cardStatus: CardStatus;
  template: string;
  recipientName: string | null;
  views: number;
  expiresAt: number | null;
}

export interface AdminPaymentRow {
  id: number;
  sepayId: string;
  orderCode: string | null;
  amount: number;
  content: string | null;
  createdAt: number;
  /** Số tiền và trạng thái của đơn (nếu tìm được mã đơn). */
  orderAmount: number | null;
  orderStatus: OrderStatus | null;
}

export interface AdminReportRow {
  id: number;
  reason: string;
  createdAt: number;
  slug: string;
  cardStatus: CardStatus;
}

export interface AdminRepository {
  /** Số đơn đã trả và tổng tiền từ mốc thời gian này. */
  revenueSince(since: number): Promise<{ orders: number; total: number }>;
  /** Số giao dịch tiền vào đã ghi nhận (khớp đơn lẫn cần xem) từ mốc này — để canh giới hạn SePay. */
  paymentsSince(since: number): Promise<number>;
  latestOrders(limit: number): Promise<AdminOrderRow[]>;
  /** Tìm theo mã đơn (TXxxxx) hoặc slug thiệp. */
  findOrders(query: string): Promise<AdminOrderRow[]>;
  openPayments(limit: number): Promise<AdminPaymentRow[]>;
  resolvePayment(id: number, at: number): Promise<boolean>;
  openReports(limit: number): Promise<AdminReportRow[]>;
  resolveReport(id: number, at: number): Promise<boolean>;
  resolveReportsOfCard(cardId: number, at: number): Promise<void>;
}

// --- Thiệp nhóm: chữ ký của từng thành viên

export interface Signature {
  id: number;
  name: string;
  message: string;
  sticker: string;
  createdAt: number;
}

export interface SignatureRepository {
  insert(cardId: number, sig: Omit<Signature, 'id'>): Promise<void>;
  countForCard(cardId: number): Promise<number>;
  listForCard(cardId: number, limit: number): Promise<Signature[]>;
  delete(cardId: number, id: number): Promise<boolean>;
}

// --- Ghi âm/ghi hình, "mở cùng nhau", sổ tình yêu chung

export type MediaKind = 'voice' | 'reaction';

export interface StoredMedia extends StoredImage {
  createdAt: number;
}

export interface MemoryEntry {
  id: number;
  /** 'gui' = người tạo thiệp, 'nhan' = người nhận. */
  author: string;
  text: string;
  hasImage: boolean;
  createdAt: number;
}

export interface ExtrasRepository {
  /** Lưu file (cắt nhiều phần). Trả false nếu thiệp đã có file loại này (không ghi đè). */
  putMedia(cardId: number, kind: MediaKind, mime: string, bytes: Uint8Array, createdAt: number): Promise<boolean>;
  getMedia(cardId: number, kind: MediaKind): Promise<StoredMedia | null>;
  /** Lúc tạo file (không đọc dữ liệu), null nếu chưa có. */
  mediaCreatedAt(cardId: number, kind: MediaKind): Promise<number | null>;
  /** Ghi "bên này vừa sẵn sàng" rồi trả về lần gần nhất của mọi bên (gồm cả mốc 'start' nếu có). */
  touchPresence(cardId: number, side: string, now: number): Promise<Record<string, number>>;
  setPresence(cardId: number, side: string, at: number): Promise<void>;
  insertMemory(cardId: number, entry: { author: string; text: string; image: StoredImage | null }, createdAt: number): Promise<void>;
  countMemories(cardId: number): Promise<number>;
  listMemories(cardId: number, limit: number): Promise<MemoryEntry[]>;
  getMemoryImage(cardId: number, id: number): Promise<StoredImage | null>;
  deleteMemory(cardId: number, id: number): Promise<boolean>;
}

// --- Số liệu tổng

export interface StatsRepository {
  get(key: string): Promise<number>;
}
