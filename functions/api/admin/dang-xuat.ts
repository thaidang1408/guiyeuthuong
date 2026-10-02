// POST /api/admin/dang-xuat → xóa cookie phiên.
import type { Env } from '../../_lib/env.ts';
import { clearSessionCookie } from '../../_lib/http/admin-cookie.ts';
import { json } from '../../_lib/http/responses.ts';

export const onRequestPost: PagesFunction<Env> = async ({ request }) =>
  json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie(request) });
