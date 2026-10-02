// POST /api/manage/<slug>/nang-cap — thiệp Cơ bản đang hoạt động: tạo đơn nâng cấp lên Đặc biệt.
// Header: Authorization: Bearer <editToken>. Trả về đơn (như GET /api/orders/<mã>) để mở trang thanh toán.
import { buildServices } from '../../../_lib/container.ts';
import type { Env } from '../../../_lib/env.ts';
import { clientIp } from '../../../_lib/http/requests.ts';
import { json } from '../../../_lib/http/responses.ts';

const tokenOf = (request: Request) => request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';

export const onRequestPost: PagesFunction<Env> = async ({ request, params, env }) => {
  return json(await buildServices(env).orderService.createUpgrade(String(params.slug), tokenOf(request), clientIp(request)), 201);
};
