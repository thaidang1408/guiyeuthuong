// GET /api/orders/<mã đơn> — trạng thái đơn (trang thanh toán hỏi mỗi 3 giây).
import { buildServices } from '../../../_lib/container.ts';
import type { Env } from '../../../_lib/env.ts';
import { json } from '../../../_lib/http/responses.ts';

export const onRequestGet: PagesFunction<Env> = async ({ request, params, env }) => {
  const { orderService, paymentSync } = buildServices(env, request);
  const code = String(params.code);
  let view = await orderService.getStatus(code);
  // Chưa thấy tiền qua webhook → thử đối soát với SePay (tối đa 10 giây một lần).
  if (view.status !== 'paid' && (await paymentSync.syncIfDue())) view = await orderService.getStatus(code);
  return json(view);
};
