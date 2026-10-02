// POST /api/sepay-webhook — SePay báo có giao dịch vào tài khoản.
// Luôn trả {"success": true} khi đã ghi nhận (kể cả cần duyệt tay hay bị trùng) để SePay không gửi lại mãi.
import { buildServices } from '../_lib/container.ts';
import type { Env } from '../_lib/env.ts';
import { readJson } from '../_lib/http/requests.ts';
import { json } from '../_lib/http/responses.ts';

const OUTCOME_TEXT: Record<string, string> = {
  matched: 'KHỚP ĐƠN → đã kích hoạt thiệp',
  needs_review: 'KHÔNG KHỚP (thiếu tiền / không thấy mã đơn / đơn đã trả) → cần duyệt tay',
  duplicate: 'TRÙNG giao dịch đã nhận → bỏ qua',
  ignored: 'tiền ra → bỏ qua',
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { paymentService } = buildServices(env);
  // Kiểm tra khóa trước khi đọc nội dung: sai khóa thì trả 401 ngay.
  try {
    await paymentService.assertAuthorized(request.headers.get('Authorization'));
  } catch (e) {
    // Ghi log để chủ dự án biết SePay có gọi tới nhưng sai khóa (không in khóa ra).
    const header = request.headers.get('Authorization');
    const headerNames = [...request.headers.keys()].filter((k) => !k.startsWith('cf-') && !k.startsWith('x-forwarded')).join(', ');
    console.warn(
      `[SePay] Webhook bị từ chối: SAI KHÓA. Header Authorization ${header ? `bắt đầu bằng "${header.split(' ')[0]}", dài ${header.length} ký tự` : 'BỊ THIẾU'}. ` +
        `Các header nhận được: ${headerNames}. ` +
        'Trên SePay, sửa webhook: "Kiểu chứng thực" = API Key, dán đúng giá trị SEPAY_WEBHOOK_KEY.',
    );
    throw e;
  }
  const body = await readJson(request, 20_000);
  const outcome = await paymentService.processTransaction(body);
  const b = body as Record<string, unknown>;
  console.log(`[SePay] Giao dịch #${b.id}: ${b.transferAmount}đ, nội dung "${b.content}" → ${OUTCOME_TEXT[outcome] ?? outcome}`);
  return json({ success: true, outcome });
};
