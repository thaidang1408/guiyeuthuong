// POST /api/reports — người xem báo cáo thiệp. Body: { slug, reason }
import { buildServices } from '../_lib/container.ts';
import type { Env } from '../_lib/env.ts';
import { clientIp, readJson } from '../_lib/http/requests.ts';
import { json } from '../_lib/http/responses.ts';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson(request);
  await buildServices(env).reportService.report(body.slug, body.reason, clientIp(request));
  return json({ ok: true }, 201);
};
