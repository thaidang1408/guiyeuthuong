// POST /api/admin/dang-nhap { password } → đặt cookie phiên.
import { buildServices } from '../../_lib/container.ts';
import type { Env } from '../../_lib/env.ts';
import { sessionCookie } from '../../_lib/http/admin-cookie.ts';
import { clientIp, readJson } from '../../_lib/http/requests.ts';
import { json } from '../../_lib/http/responses.ts';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson(request, 500);
  const token = await buildServices(env, request).adminService.login(body.password, clientIp(request));
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(request, token) });
};
