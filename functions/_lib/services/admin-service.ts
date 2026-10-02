import { ADMIN_LOGIN_LIMIT, ADMIN_PASSWORD_MIN, SEPAY_MONTHLY_LIMIT } from '../config.ts';
import { startOfMonthVietnam } from '../domain/time.ts';
import { createSessionToken, startOfDayVietnam, verifySessionToken } from '../domain/admin-session.ts';
import { AppError, badRequest, notFound, tooMany } from '../domain/errors.ts';
import { ORDER_CODE_PATTERN, SLUG_PATTERN } from '../domain/ids.ts';
import { safeEqual } from '../domain/security.ts';
import type { AdminRepository, CardRepository, OrderRepository, RateLimitRepository } from '../repositories/interfaces.ts';
import type { OrderService } from './order-service.ts';

const DAY = 24 * 60 * 60 * 1000;

export interface AdminServiceDeps {
  admin: AdminRepository;
  cards: CardRepository;
  orders: OrderRepository;
  orderService: OrderService;
  rateLimits: RateLimitRepository;
  now: () => number;
  /** Mật khẩu quản trị (secret ADMIN_PASSWORD). */
  password: string | undefined;
  /** Chạy ở máy thì cho dùng mật khẩu ngắn để thử cho tiện. */
  isLocal: boolean;
}

/** Trang /admin của chủ dự án: đăng nhập, xem doanh thu, xử lý giao dịch cần xem, báo cáo, gỡ thiệp. */
export class AdminService {
  deps: AdminServiceDeps;
  constructor(deps: AdminServiceDeps) {
    this.deps = deps;
  }

  /** Mật khẩu hợp lệ để dùng; null = trang quản trị đang tắt. */
  private get password(): string | null {
    const p = this.deps.password ?? '';
    if (!p) return null;
    if (!this.deps.isLocal && (p.length < ADMIN_PASSWORD_MIN || p === 'doi-mat-khau-nay')) return null;
    return p;
  }

  /** Đăng nhập: trả về giá trị cookie phiên. */
  async login(input: unknown, clientIp: string): Promise<string> {
    const password = this.password;
    if (!password) {
      throw new AppError(503, `Trang quản trị chưa bật: hãy đặt ADMIN_PASSWORD (tối thiểu ${ADMIN_PASSWORD_MIN} ký tự).`);
    }
    const now = this.deps.now();
    // Đếm mọi lần thử (kể cả đúng) để kẻ xấu không dò mật khẩu được.
    const count = await this.deps.rateLimits.hit(`admin-login:${clientIp}`, now, ADMIN_LOGIN_LIMIT.windowMs);
    if (count > ADMIN_LOGIN_LIMIT.max) throw tooMany('Thử sai nhiều lần quá, đợi 15 phút nhé.');
    if (typeof input !== 'string' || !(await safeEqual(input, password))) throw new AppError(401, 'Sai mật khẩu.');
    return createSessionToken(password, now);
  }

  async isLoggedIn(token: string | null): Promise<boolean> {
    const password = this.password;
    return !!password && verifySessionToken(password, token, this.deps.now());
  }

  async dashboard() {
    const { admin, now } = this.deps;
    const today = startOfDayVietnam(now());
    const monthStart = startOfMonthVietnam(now());
    const [revenueToday, revenueWeek, revenue30, orders, payments, reports, sepayUsed] = await Promise.all([
      admin.revenueSince(today),
      admin.revenueSince(today - 6 * DAY),
      admin.revenueSince(today - 29 * DAY),
      admin.latestOrders(30),
      admin.openPayments(50),
      admin.openReports(50),
      admin.paymentsSince(monthStart),
    ]);
    return {
      revenue: { today: revenueToday, week: revenueWeek, month: revenue30 },
      sepay: { used: sepayUsed, limit: SEPAY_MONTHLY_LIMIT },
      orders,
      payments,
      reports,
    };
  }

  async search(query: unknown) {
    const q = typeof query === 'string' ? query.trim() : '';
    if (!ORDER_CODE_PATTERN.test(q.toUpperCase()) && !SLUG_PATTERN.test(q.toLowerCase())) {
      throw badRequest('Nhập mã đơn (ví dụ TXAB23) hoặc mã thiệp 8 ký tự.');
    }
    return this.deps.admin.findOrders(q);
  }

  /** Kích hoạt thủ công (khách chuyển thiếu, sai nội dung…). Có paymentId thì đánh dấu giao dịch đó đã xử lý. */
  async activate(code: unknown, paymentId: unknown): Promise<void> {
    const orderCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
    if (!ORDER_CODE_PATTERN.test(orderCode)) throw badRequest('Mã đơn không đúng dạng TX + 4 ký tự.');
    const order = await this.deps.orders.findByCode(orderCode);
    if (!order) throw notFound('Không tìm thấy đơn này (có thể thiệp nháp đã bị dọn sau 24 giờ).');
    if (order.status === 'paid') throw badRequest('Đơn này đã thanh toán và kích hoạt rồi.');
    if (!(await this.deps.orderService.activateOrder(orderCode))) throw badRequest('Không kích hoạt được đơn này.');
    if (typeof paymentId === 'number') await this.deps.admin.resolvePayment(paymentId, this.deps.now());
  }

  /** Bỏ qua giao dịch cần xem (ví dụ tiền không liên quan đến app). */
  async dismissPayment(paymentId: unknown): Promise<void> {
    if (typeof paymentId !== 'number' || !(await this.deps.admin.resolvePayment(paymentId, this.deps.now()))) {
      throw notFound('Giao dịch không tồn tại hoặc đã xử lý.');
    }
  }

  async dismissReport(reportId: unknown): Promise<void> {
    if (typeof reportId !== 'number' || !(await this.deps.admin.resolveReport(reportId, this.deps.now()))) {
      throw notFound('Báo cáo không tồn tại hoặc đã xử lý.');
    }
  }

  /** Gỡ thiệp vi phạm: link không mở được nữa, ảnh và nhạc bị xóa, báo cáo của thiệp được đóng. */
  async removeCard(slug: unknown): Promise<void> {
    const s = typeof slug === 'string' ? slug.trim().toLowerCase() : '';
    const card = SLUG_PATTERN.test(s) ? await this.deps.cards.findBySlug(s) : null;
    if (!card) throw notFound('Không tìm thấy thiệp.');
    if (card.status === 'removed') throw badRequest('Thiệp này đã được gỡ trước đó.');
    await this.deps.cards.remove(card.id);
    await this.deps.admin.resolveReportsOfCard(card.id, this.deps.now());
  }
}
