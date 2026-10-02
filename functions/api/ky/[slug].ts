// POST /api/ky/<slug> — trang ký tên thiệp nhóm. Mã mời gửi trong body (không nằm trên đường dẫn).
//   { token, action: "info" }                         xem thiệp gửi ai, ai đã ký
//   { token, action: "sign", name, message, sticker } ký tên + lời chúc
import { buildServices } from '../../_lib/container.ts';
import type { Env } from '../../_lib/env.ts';
import { clientIp, readJson } from '../../_lib/http/requests.ts';
import { json } from '../../_lib/http/responses.ts';

export const onRequestPost: PagesFunction<Env> = async ({ request, params, env }) => {
  const body = await readJson(request, 2000);
  const group = buildServices(env).groupService;
  const slug = String(params.slug);
  if (body.action === 'sign') return json(await group.sign(slug, body.token, body, clientIp(request)), 201);
  return json(await group.info(slug, body.token));
};
