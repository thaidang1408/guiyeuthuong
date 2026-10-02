// POST /api/cung-mo/<slug> — "Mở cùng nhau": một bên báo sẵn sàng, trả về bên kia đã sẵn sàng chưa
// và mốc cùng mở. Body: { side: 'gui' | 'nhan' }. Người tạo (side 'gui') gửi kèm Authorization: Bearer <mã sửa>.
import { buildServices } from '../../_lib/container.ts';
import type { Env } from '../../_lib/env.ts';
import { clientIp, readJson } from '../../_lib/http/requests.ts';
import { json } from '../../_lib/http/responses.ts';

const tokenOf = (request: Request) => request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';

export const onRequestPost: PagesFunction<Env> = async ({ request, params, env }) => {
  const body = await readJson(request, 500);
  return json(await buildServices(env).extrasService.together(String(params.slug), body.side, tokenOf(request), clientIp(request)));
};
