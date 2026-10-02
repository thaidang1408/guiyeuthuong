// Nơi "lắp ráp" các lớp: tạo repository từ D1 rồi đưa vào service.
// Route chỉ cần gọi buildServices(env) để có service dùng.
import { type Env, devToolsEnabled, isLocalRun } from './env.ts';
import { D1AdminRepository } from './repositories/d1-admin-repository.ts';
import { D1CardRepository } from './repositories/d1-card-repository.ts';
import { D1ExtrasRepository } from './repositories/d1-extras-repository.ts';
import {
  D1RateLimitRepository,
  D1ReportRepository,
  D1ResponseRepository,
  D1SignatureRepository,
  D1StatsRepository,
} from './repositories/d1-misc-repositories.ts';
import { D1OrderRepository } from './repositories/d1-order-repository.ts';
import { D1PaymentRepository } from './repositories/d1-payment-repository.ts';
import { SepayApiFeed } from './repositories/sepay-api-feed.ts';
import { AdminService } from './services/admin-service.ts';
import { CardService } from './services/card-service.ts';
import { DevPaymentSimulator } from './services/dev-payment-simulator.ts';
import { ExtrasService } from './services/extras-service.ts';
import { GroupService } from './services/group-service.ts';
import { ManageService } from './services/manage-service.ts';
import { OrderService } from './services/order-service.ts';
import { PaymentService } from './services/payment-service.ts';
import { PaymentSyncService } from './services/payment-sync-service.ts';
import { ReportService } from './services/report-service.ts';
import { ResponseService } from './services/response-service.ts';

/** request (không bắt buộc): để nhận biết đang chạy ở máy theo địa chỉ trang (xem isLocalHost). */
export function buildServices(env: Env, request?: Request) {
  const now = () => Date.now();
  const cards = new D1CardRepository(env.DB);
  const orders = new D1OrderRepository(env.DB);
  const rateLimits = new D1RateLimitRepository(env.DB);

  const signatures = new D1SignatureRepository(env.DB);
  const cardService = new CardService({ cards, orders, rateLimits, now, signatures });
  const paymentService = new PaymentService({
    payments: new D1PaymentRepository(env.DB),
    orders,
    now,
    webhookKey: env.SEPAY_WEBHOOK_KEY,
  });
  const extras = new D1ExtrasRepository(env.DB);
  const extrasService = new ExtrasService({ cardService, cards, extras, rateLimits, now });
  const responseService = new ResponseService({ cardService, cards, responses: new D1ResponseRepository(env.DB), rateLimits, now });
  const orderService = new OrderService({
    orders,
    cards,
    now,
    account: env.SEPAY_ACC && env.SEPAY_BANK ? { acc: env.SEPAY_ACC, bank: env.SEPAY_BANK } : null,
    devSimulate: devToolsEnabled(env, request),
    rateLimits,
  });
  return {
    cardService,
    orderService,
    paymentService,
    paymentSync: new PaymentSyncService({
      feed: env.SEPAY_API_TOKEN ? new SepayApiFeed(env.SEPAY_API_TOKEN) : null,
      payments: paymentService,
      rateLimits,
      now,
    }),
    devSimulator: new DevPaymentSimulator(orders, paymentService),
    manageService: new ManageService({ cards, orders, now, responses: responseService, signatures, extras: extrasService }),
    extrasService,
    groupService: new GroupService({ cards, signatures, rateLimits, now }),
    stats: new D1StatsRepository(env.DB),
    responseService,
    adminService: new AdminService({
      admin: new D1AdminRepository(env.DB),
      cards,
      orders,
      orderService,
      rateLimits,
      now,
      password: env.ADMIN_PASSWORD,
      isLocal: isLocalRun(env, request),
    }),
    reportService: new ReportService({ cardService, reports: new D1ReportRepository(env.DB), rateLimits, now }),
  };
}
