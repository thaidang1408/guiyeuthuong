// /api/manage/<slug> — trang quản lý của người tạo. Header: Authorization: Bearer <editToken>
//   GET  xem thông tin thiệp
//   PUT  sửa câu chữ (gói Đặc biệt). Body: { recipientName, senderName, texts }
import { buildServices } from '../../_lib/container.ts';
import type { Env } from '../../_lib/env.ts';
import { readJson } from '../../_lib/http/requests.ts';
import { json } from '../../_lib/http/responses.ts';

const tokenOf = (request: Request) => request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';

export const onRequestGet: PagesFunction<Env> = async ({ request, params, env }) => {
  return json(await buildServices(env).manageService.getView(String(params.slug), tokenOf(request)));
};

export const onRequestPut: PagesFunction<Env> = async ({ request, params, env }) => {
  const body = await readJson(request, 20_000);
  return json(await buildServices(env).manageService.updateTexts(String(params.slug), tokenOf(request), body));
};
