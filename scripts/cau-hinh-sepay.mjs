// Cấu hình tài khoản ngân hàng + SePay cho máy của bạn (ghi vào .dev.vars, file này KHÔNG lên git).
// Chạy: npm run cau-hinh
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';

const FILE = '.dev.vars';
const PLACEHOLDER_KEYS = new Set(['', 'khoa-thu-o-may']);
const COMMON_BANKS = 'MBBank, Vietcombank, VietinBank, BIDV, Agribank, Techcombank, ACB, VPBank, TPBank, Sacombank, VIB, HDBank, OCB, MSB, SHB';

// --- đọc .dev.vars hiện có (giữ nguyên các dòng khác)
const text = existsSync(FILE) ? readFileSync(FILE, 'utf8') : existsSync('.dev.vars.example') ? readFileSync('.dev.vars.example', 'utf8') : '';
const vars = new Map();
for (const line of text.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) vars.set(m[1], m[2].trim());
}

// Đọc từng dòng vào hàng đợi: chạy được cả khi gõ tay lẫn khi dữ liệu được đưa vào sẵn.
const rl = createInterface({ input, terminal: false });
const lines = [];
let waiting = null;
let closed = false;
rl.on('line', (line) => (waiting ? (waiting(line), (waiting = null)) : lines.push(line)));
rl.on('close', () => {
  closed = true;
  if (waiting) waiting('');
});
const nextLine = () => (lines.length ? Promise.resolve(lines.shift()) : closed ? Promise.resolve(null) : new Promise((r) => (waiting = r)));
const ask = async (question, fallback = '') => {
  output.write(fallback ? `${question} [${fallback}]: ` : `${question}: `);
  const line = await nextLine();
  if (line === null) {
    console.log('');
    console.log('Đã dừng (không có dữ liệu nhập).');
    process.exit(1);
  }
  return line.trim() || fallback;
};

/** Hỏi dịch vụ QR xem có nhận tên ngân hàng này không. */
async function bankSupported(bank) {
  try {
    const res = await fetch(`https://vietqr.app/img?acc=0123456789&bank=${encodeURIComponent(bank)}&amount=1000&des=TEST&template=compact`);
    return (res.headers.get('content-type') || '').startsWith('image/');
  } catch {
    console.log('  (Không kiểm tra được vì mất mạng — tạm chấp nhận.)');
    return true;
  }
}

console.log('\n=== Cấu hình tài khoản nhận tiền ===\n');
console.log('Gợi ý tên ngân hàng: ' + COMMON_BANKS + '\n');

let bank;
for (;;) {
  bank = await ask('Tên ngân hàng', vars.get('SEPAY_BANK') && vars.get('SEPAY_BANK') !== 'MBBank' ? vars.get('SEPAY_BANK') : '');
  if (!bank) continue;
  if (await bankSupported(bank)) break;
  console.log(`  ✗ Dịch vụ QR không nhận "${bank}". Thử lại với tên khác trong danh sách gợi ý (viết đúng hoa/thường).`);
}

let acc;
console.log('\nSố tài khoản phải là tài khoản ĐÃ LIÊN KẾT với SePay.');
console.log('Nếu SePay cấp cho bạn "tài khoản ảo (VA)" để nhận tiền, hãy nhập số VA đó.');
for (;;) {
  const current = vars.get('SEPAY_ACC');
  acc = (await ask('Số tài khoản', current && current !== '0000000000' ? current : '')).replace(/\s+/g, '');
  if (/^[A-Za-z0-9]{4,25}$/.test(acc)) break;
  console.log('  ✗ Số tài khoản chỉ gồm chữ số (hoặc chữ cái với tài khoản ảo), không dấu cách.');
}

let key = vars.get('SEPAY_WEBHOOK_KEY') || '';
let newKey = false;
if (PLACEHOLDER_KEYS.has(key) || process.argv.includes('--tao-khoa-moi')) {
  key = randomBytes(24).toString('base64url');
  newKey = true;
}

console.log('');
console.log('API Access của SePay (my.sepay.vn → Cấu hình công ty → API Access) giúp app tự đối soát');
console.log('khi webhook không tới. Không bắt buộc nhưng nên có. Bỏ trống nếu chưa có.');
const currentToken = vars.get('SEPAY_API_TOKEN') || '';
const tokenAnswer = await ask('API Access', currentToken ? '(giữ nguyên)' : '');
const apiToken = tokenAnswer === '(giữ nguyên)' ? currentToken : tokenAnswer.replace(/\s+/g, '');

let zalo;
for (;;) {
  const current = vars.get('SUPPORT_ZALO');
  zalo = (await ask('\nSố Zalo nhận hỗ trợ khách (hiện ở trang /ho-tro)', current && current !== '0900000000' ? current : '')).replace(/[^\d]/g, '');
  if (/^0\d{9}$/.test(zalo)) break;
  console.log('  ✗ Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.');
}

const simulate = (await ask('\nHiện nút "Giả lập tiền về" trên trang thanh toán khi chạy ở máy? (c/k)', 'c')).toLowerCase().startsWith('c');
rl.close();

vars.set('SEPAY_BANK', bank);
vars.set('SEPAY_ACC', acc);
vars.set('SEPAY_WEBHOOK_KEY', key);
vars.set('DEV_SIMULATE_PAYMENT', simulate ? '1' : '0');
vars.set('SUPPORT_ZALO', zalo);
if (apiToken) vars.set('SEPAY_API_TOKEN', apiToken);
else vars.delete('SEPAY_API_TOKEN');
if (!vars.has('ADMIN_PASSWORD')) vars.set('ADMIN_PASSWORD', 'doi-mat-khau-nay');

writeFileSync(
  FILE,
  '# Biến môi trường khi chạy ở máy. KHÔNG đưa file này lên git, KHÔNG gửi cho ai.\n' +
    '# Tạo/sửa bằng: npm run cau-hinh\n' +
    [...vars].map(([k, v]) => `${k}=${v}`).join('\n') +
    '\n',
);

console.log(`
✓ Đã lưu vào ${FILE}: ngân hàng ${bank}, số tài khoản ${acc}${newKey ? ', khóa webhook mới' : ''}.

=== Việc tiếp theo trên trang SePay (my.sepay.vn) ===
Vào mục WebHooks → Thêm webhook, điền:
  • Sự kiện: Có tiền vào
  • Gọi đến URL: <địa chỉ đường hầm>/api/sepay-webhook   (xem README, mục "Thử với SePay thật")
  • Kiểu chứng thực: API Key
  • API Key: ${key}
  • "Bỏ qua nếu nội dung không có Code thanh toán": chọn KHÔNG
Và trong Cấu hình công ty → Cấu trúc mã thanh toán: thêm tiền tố "TX", phần sau 4 ký tự (chữ + số)
→ SePay nhận ra mã đơn và gửi webhook ngay khi tiền về.

Nhớ tắt server (Ctrl + C) rồi chạy lại "npm run dev" để nhận cấu hình mới.
`);
