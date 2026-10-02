import { REPORT_REASON_MAX } from '../config.ts';
import { badRequest, notFound, tooMany } from '../domain/errors.ts';
import type { RateLimitRepository, ReportRepository } from '../repositories/interfaces.ts';
import type { CardService } from './card-service.ts';

const REPORT_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 };

export interface ReportServiceDeps {
  cardService: CardService;
  reports: ReportRepository;
  rateLimits: RateLimitRepository;
  now: () => number;
}

export class ReportService {
  deps: ReportServiceDeps;
  constructor(deps: ReportServiceDeps) {
    this.deps = deps;
  }

  /** Người xem báo cáo một thiệp có nội dung xấu. */
  async report(slug: unknown, reason: unknown, clientIp: string): Promise<void> {
    const text = typeof reason === 'string' ? reason.replace(/[\u0000-\u001F\u007F]/g, ' ').trim() : '';
    if (!text) throw badRequest('Bạn cho mình biết lý do báo cáo nhé.');
    if ([...text].length > REPORT_REASON_MAX) throw badRequest(`Lý do dài quá (tối đa ${REPORT_REASON_MAX} ký tự).`);

    const card = typeof slug === 'string' ? await this.deps.cardService.findActiveCard(slug) : null;
    if (!card) throw notFound('Không tìm thấy thiệp.');

    const now = this.deps.now();
    const count = await this.deps.rateLimits.hit(`report:${clientIp}`, now, REPORT_LIMIT.windowMs);
    if (count > REPORT_LIMIT.max) throw tooMany('Bạn đã gửi nhiều báo cáo, đợi một lát nhé.');

    await this.deps.reports.insert(card.id, text, now);
  }
}
