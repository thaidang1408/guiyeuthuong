import { RESPONSE_LIMIT, RESPONSES_PER_CARD } from '../config.ts';
import type { CardData } from '../domain/card-data.ts';
import { type DiChoiAnswer, validateAnswer } from '../domain/di-choi.ts';
import { badRequest, notFound, tooMany } from '../domain/errors.ts';
import { findBadWord } from '../domain/profanity.ts';
import type { CardRecord, CardRepository, RateLimitRepository, ResponseRepository } from '../repositories/interfaces.ts';
import type { CardService } from './card-service.ts';

/** Mẫu thiệp có ô trả lời (chọn ngày, món) cho người nhận. */
export const ANSWERABLE_TEMPLATES = new Set(['di-choi']);

export const REPLY_MAX = 500;
const REACT_LIMIT = { max: 30, windowMs: 60 * 60 * 1000 };

export interface ResponseServiceDeps {
  cardService: CardService;
  cards: CardRepository;
  responses: ResponseRepository;
  rateLimits: RateLimitRepository;
  now: () => number;
}

/** Một câu trả lời của người nhận: chọn ngày/món (mẫu "Đi chơi") hoặc thư đáp lại (mọi mẫu). */
export type ResponseView =
  | ({ kind: 'di-choi'; createdAt: number } & DiChoiAnswer)
  | { kind: 'reply'; text: string; createdAt: number }
  | { kind: 'vong-quay'; index: number; prize: string; createdAt: number }
  | { kind: 'cau-do'; answers: number[]; score: number; total: number; createdAt: number };

/** Kết quả trò chơi trả về cho người nhận. */
export type GameResult = { kind: 'vong-quay'; index: number; prize: string } | { kind: 'cau-do'; score: number; total: number };

/** Những gì người nhận gửi ngược lại cho người tạo: câu trả lời, thư đáp lại, phản ứng. */
export class ResponseService {
  deps: ResponseServiceDeps;
  constructor(deps: ResponseServiceDeps) {
    this.deps = deps;
  }

  private async activeCard(slug: unknown): Promise<CardRecord> {
    const card = typeof slug === 'string' ? await this.deps.cardService.findActiveCard(slug) : null;
    if (!card) throw notFound('Không tìm thấy thiệp.');
    return card;
  }

  private async checkLimits(card: CardRecord, clientIp: string, now: number): Promise<void> {
    const count = await this.deps.rateLimits.hit(`answer:${clientIp}`, now, RESPONSE_LIMIT.windowMs);
    if (count > RESPONSE_LIMIT.max) throw tooMany('Bạn gửi nhiều quá, đợi một lát nhé.');
    if ((await this.deps.responses.countForCard(card.id)) >= RESPONSES_PER_CARD) {
      throw tooMany('Thiệp này đã nhận đủ câu trả lời rồi.');
    }
  }

  /** Mẫu "Đi chơi": người nhận chọn ngày, món ăn. */
  async submit(slug: unknown, raw: unknown, clientIp: string): Promise<void> {
    const card = await this.activeCard(slug);
    if (!ANSWERABLE_TEMPLATES.has(card.template)) throw notFound('Không tìm thấy thiệp.');
    const now = this.deps.now();
    const answer = validateAnswer(raw, now);
    await this.checkLimits(card, clientIp, now);
    await this.deps.responses.insert(card.id, JSON.stringify(answer), now);
  }

  /** Thư đáp lại ngắn của người nhận (mọi mẫu). */
  async reply(slug: unknown, rawText: unknown, clientIp: string): Promise<void> {
    const card = await this.activeCard(slug);
    const text = (typeof rawText === 'string' ? rawText : '')
      .normalize('NFC')
      .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (!text) throw badRequest('Bạn viết vài chữ trước đã nhé.');
    if ([...text].length > REPLY_MAX) throw badRequest(`Thư dài quá (tối đa ${REPLY_MAX} ký tự).`);
    const bad = findBadWord(text);
    if (bad) throw badRequest(`Có từ chưa phù hợp ("${bad}"), bạn sửa lại giúp mình nhé.`);
    const now = this.deps.now();
    await this.checkLimits(card, clientIp, now);
    await this.deps.responses.insert(card.id, JSON.stringify({ kind: 'reply', text }), now);
  }

  /**
   * Trò chơi cuối thiệp. Chỉ lần chơi đầu tiên được ghi lại (người tạo xem ở trang quản lý);
   * chơi lại thì trả về đúng kết quả cũ — vòng quay không "quay lại cho tới khi trúng quà xịn" được.
   * Vòng quay do server bốc thăm, câu đố do server chấm điểm.
   */
  async play(slug: unknown, raw: unknown, clientIp: string, random: () => number = Math.random): Promise<GameResult> {
    const card = await this.activeCard(slug);
    const game = (JSON.parse(card.dataJson) as CardData).game;
    const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    if (!game?.id || input.kind !== game.id) throw notFound('Thiệp này không có trò chơi đó.');

    const previous = (await this.deps.responses.listForCard(card.id, RESPONSES_PER_CARD))
      .map((r) => JSON.parse(r.answerJson))
      .find((v) => v.kind === game.id);
    if (previous) return toResult(previous);

    let result: GameResult;
    let record: Record<string, unknown>;
    if (game.id === 'vong-quay' && game.prizes?.length) {
      const index = Math.min(game.prizes.length - 1, Math.floor(random() * game.prizes.length));
      result = { kind: 'vong-quay', index, prize: game.prizes[index] };
      record = result;
    } else if (game.id === 'cau-do' && game.quiz?.length) {
      const quiz = game.quiz;
      const raws = Array.isArray(input.answers) ? input.answers : [];
      if (raws.length !== quiz.length) throw badRequest('Bạn trả lời chưa đủ câu.');
      const answers = quiz.map((q, i) => (Number.isInteger(raws[i]) && raws[i] >= 0 && raws[i] < q.options.length ? (raws[i] as number) : -1));
      if (answers.includes(-1)) throw badRequest('Câu trả lời không hợp lệ.');
      const score = answers.filter((a, i) => a === quiz[i].answer).length;
      result = { kind: 'cau-do', score, total: quiz.length };
      record = { ...result, answers };
    } else {
      throw notFound('Thiệp này không có trò chơi đó.');
    }
    await this.checkLimits(card, clientIp, this.deps.now());
    await this.deps.responses.insert(card.id, JSON.stringify(record), this.deps.now());
    return result;
  }

  /** Người nhận vừa bấm "Có"/"Tha"/hoàn thành: ghi số lần bấm "Không" và thời gian suy nghĩ (chỉ lần đầu). */
  async react(slug: unknown, raw: unknown, clientIp: string): Promise<void> {
    const card = await this.activeCard(slug);
    const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const int = (v: unknown, max: number) => (Number.isFinite(v) ? Math.min(max, Math.max(0, Math.round(v as number))) : 0);
    const now = this.deps.now();
    if ((await this.deps.rateLimits.hit(`react:${clientIp}`, now, REACT_LIMIT.windowMs)) > REACT_LIMIT.max) {
      throw tooMany('Bạn thao tác nhanh quá, đợi một lát nhé.');
    }
    await this.deps.cards.recordYes(card.id, now, int(input.noPresses, 999), int(input.thinkMs, 24 * 60 * 60 * 1000));
  }

  /** Mới nhất trước (dùng cho trang quản lý của người tạo). */
  async listForCard(cardId: number): Promise<ResponseView[]> {
    const rows = await this.deps.responses.listForCard(cardId, RESPONSES_PER_CARD);
    return rows.map((r): ResponseView => {
      const v = JSON.parse(r.answerJson);
      if (v.kind === 'reply') return { kind: 'reply', text: String(v.text), createdAt: r.createdAt };
      if (v.kind === 'vong-quay') return { kind: 'vong-quay', index: v.index, prize: String(v.prize), createdAt: r.createdAt };
      if (v.kind === 'cau-do') return { kind: 'cau-do', answers: v.answers, score: v.score, total: v.total, createdAt: r.createdAt };
      return { kind: 'di-choi', ...(v as DiChoiAnswer), createdAt: r.createdAt };
    });
  }
}

function toResult(v: Record<string, unknown>): GameResult {
  return v.kind === 'vong-quay'
    ? { kind: 'vong-quay', index: Number(v.index), prize: String(v.prize) }
    : { kind: 'cau-do', score: Number(v.score), total: Number(v.total) };
}
