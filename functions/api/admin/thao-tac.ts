// POST /api/admin/thao-tac — các nút xử lý trên trang quản trị.
//   { action: "kich-hoat", code, paymentId? }   kích hoạt thủ công
//   { action: "bo-qua-giao-dich", paymentId }   giao dịch không cần xử lý
//   { action: "go-thiep", slug }                gỡ thiệp vi phạm
//   { action: "bo-qua-bao-cao", reportId }      báo cáo không có vấn đề
import { buildServices } from '../../_lib/container.ts';
import { badRequest } from '../../_lib/domain/errors.ts';
import type { Env } from '../../_lib/env.ts';
import { readJson } from '../../_lib/http/requests.ts';
import { json } from '../../_lib/http/responses.ts';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson(request, 500);
  const admin = buildServices(env).adminService;
  switch (body.action) {
    case 'kich-hoat':
      await admin.activate(body.code, body.paymentId);
      break;
    case 'bo-qua-giao-dich':
      await admin.dismissPayment(body.paymentId);
      break;
    case 'go-thiep':
      await admin.removeCard(body.slug);
      break;
    case 'bo-qua-bao-cao':
      await admin.dismissReport(body.reportId);
      break;
    default:
      throw badRequest('Thao tác không hợp lệ.');
  }
  return json({ ok: true });
};
