import { badRequest } from './errors.ts';
import { extractOrderCode } from './order-code.ts';

/** Những trường cần dùng trong dữ liệu SePay gửi tới webhook. */
export interface SepayTransaction {
  id: string;
  transferType: string;
  transferAmount: number;
  code: string | null;
  content: string | null;
  /** Mã đơn tìm được trong code/content, hoặc null. */
  orderCode: string | null;
}

/** Đọc và kiểm tra dữ liệu webhook. Ném lỗi 400 nếu thiếu trường bắt buộc. */
export function parseSepayTransaction(body: unknown): SepayTransaction {
  if (!body || typeof body !== 'object') throw badRequest('Invalid payload');
  const b = body as Record<string, unknown>;

  const id = typeof b.id === 'number' || typeof b.id === 'string' ? String(b.id).trim() : '';
  if (!id) throw badRequest('Missing id');

  const transferAmount = Number(b.transferAmount);
  if (!Number.isFinite(transferAmount) || transferAmount < 0) throw badRequest('Invalid transferAmount');

  const code = typeof b.code === 'string' ? b.code : null;
  const content = typeof b.content === 'string' ? b.content : null;

  return {
    id,
    transferType: String(b.transferType ?? ''),
    transferAmount: Math.floor(transferAmount),
    code,
    content,
    orderCode: extractOrderCode(code, content),
  };
}
