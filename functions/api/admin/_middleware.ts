// Mọi /api/admin/* (trừ đăng nhập) đều cần cookie phiên quản trị hợp lệ.
import { buildServices } from '../../_lib/container.ts';
import type { Env } from '../../_lib/env.ts';
import { assertSameOrigin, readSession } from '../../_lib/http/admin-cookie.ts';
import { json } from '../../_lib/http/responses.ts';

export const onRequest: PagesFunction<Env> = async ({ request, env, next }) => {
  assertSameOrigin(request);
  if (new URL(request.url).pathname === '/api/admin/dang-nhap') return next();
  if (!(await buildServices(env).adminService.isLoggedIn(readSession(request)))) {
    return json({ error: 'Phiên đăng nhập đã hết, bạn đăng nhập lại nhé.' }, 401);
  }
  const res = await next();
  res.headers.set('X-Robots-Tag', 'noindex');
  return res;
};
