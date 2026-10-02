// GET /api/admin/tim?q=<mã đơn hoặc mã thiệp>
import { buildServices } from '../../_lib/container.ts';
import type { Env } from '../../_lib/env.ts';
import { json } from '../../_lib/http/responses.ts';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) =>
  json({ orders: await buildServices(env).adminService.search(new URL(request.url).searchParams.get('q')) });
