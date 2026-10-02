// POST /api/manage/<slug>/xoa-chu-ky { id } — người tổ chức xóa một lời chúc trong thiệp nhóm.
// Header: Authorization: Bearer <editToken>
import { buildServices } from '../../../_lib/container.ts';
import type { Env } from '../../../_lib/env.ts';
import { readJson } from '../../../_lib/http/requests.ts';
import { json } from '../../../_lib/http/responses.ts';

export const onRequestPost: PagesFunction<Env> = async ({ request, params, env }) => {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const body = await readJson(request, 200);
  return json(await buildServices(env).manageService.deleteSignature(String(params.slug), token, body.id));
};
