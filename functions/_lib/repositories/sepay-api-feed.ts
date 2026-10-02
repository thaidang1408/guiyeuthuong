import { SEPAY_SYNC } from '../config.ts';
import type { BankTransaction, BankTransactionFeed } from './interfaces.ts';

interface SepayApiTransaction {
  id: string | number;
  amount_in: string | number;
  transaction_content: string | null;
  code: string | null;
  transaction_date: string;
}

/** Đọc danh sách giao dịch qua API của SePay (cần API Access). */
export class SepayApiFeed implements BankTransactionFeed {
  token: string;
  constructor(token: string) {
    this.token = token;
  }

  async listRecent(limit: number): Promise<BankTransaction[]> {
    const res = await fetch(`${SEPAY_SYNC.apiBase}/transactions/list?limit=${limit}`, {
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`SePay API trả lỗi HTTP ${res.status}`);
    const body = (await res.json()) as { transactions?: SepayApiTransaction[] };
    return (body.transactions ?? []).map((t) => ({
      id: String(t.id),
      amountIn: Number(t.amount_in) || 0,
      content: t.transaction_content,
      code: t.code,
      transactionDate: t.transaction_date,
    }));
  }
}
