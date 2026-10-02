// Bản Node của gia-lap-webhook.sh — chạy được thẳng trong PowerShell/CMD trên Windows.
//   npm run gia-lap -- TXABCD            # tự lấy số tiền đúng của đơn
//   npm run gia-lap -- TXABCD 10000      # chuyển thiếu → đơn cần duyệt tay
//   npm run gia-lap -- TXABCD 15000 sai  # thử khóa sai → bị từ chối (401)
//   npm run gia-lap -- TXABCD 15000 "" 123   # gửi với mã giao dịch 123 (gửi 2 lần để thử trùng)
import { readFileSync } from 'node:fs';

const [code, amountArg, keyArg, idArg] = process.argv.slice(2);
const base = process.env.URL || 'http://127.0.0.1:8788';
if (!code) {
  console.log('Thiếu mã đơn. Ví dụ: npm run gia-lap -- TXABCD');
  process.exit(1);
}

let amount = Number(amountArg);
if (!amountArg) {
  const res = await fetch(`${base}/api/orders/${code.toUpperCase()}`);
  if (!res.ok) {
    console.log(`Không tìm thấy đơn ${code} (server có đang chạy không?)`);
    process.exit(1);
  }
  amount = (await res.json()).amount;
}

const devVars = readFileSync('.dev.vars', 'utf8');
const key = keyArg || devVars.match(/^SEPAY_WEBHOOK_KEY=(.*)$/m)?.[1]?.trim();
const id = idArg || String(Date.now());

const res = await fetch(`${base}/api/sepay-webhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Apikey ${key}` },
  body: JSON.stringify({
    id: Number(id),
    gateway: 'MBBank',
    transactionDate: new Date().toISOString().slice(0, 19).replace('T', ' '),
    accountNumber: '0000000000',
    code: null,
    content: `NGUYEN VAN A chuyen tien ${code}`,
    transferType: 'in',
    transferAmount: amount,
    accumulated: 0,
    subAccount: null,
    referenceCode: `FT${id}`,
    description: '',
  }),
});
const body = await res.text();
console.log(`Giả lập chuyển ${amount.toLocaleString('vi-VN')}đ cho đơn ${code} (giao dịch #${id})`);
console.log(`→ HTTP ${res.status} ${body}`);
const outcome = (() => { try { return JSON.parse(body).outcome; } catch { return null; } })();
const meaning = {
  matched: '✅ Khớp đơn — thiệp đã được kích hoạt.',
  needs_review: '⚠️ Không khớp (thiếu tiền / sai mã / đã trả rồi) — cần duyệt tay.',
  duplicate: '🔁 Giao dịch này đã ghi nhận trước đó — bỏ qua.',
  ignored: 'Bỏ qua (không phải tiền vào).',
};
console.log(res.status === 401 ? '⛔ Sai khóa — bị từ chối đúng như mong đợi.' : meaning[outcome] || '');
