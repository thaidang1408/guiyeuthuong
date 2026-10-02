// POST /api/tra-loi/<slug> { date, food, note } — người nhận trả lời thiệp "Đi chơi".
import { buildServices } from '../../_lib/container.ts';
import type { Env } from '../../_lib/env.ts';
import { clientIp, readJson } from '../../_lib/http/requests.ts';
import { json } from '../../_lib/http/responses.ts';

export const onRequestPost: PagesFunction<Env> = async ({ request, params, env }) => {
  const body = await readJson(request, 1000);
  await buildServices(env).responseService.submit(String(params.slug), body, clientIp(request));
  return json({ ok: true }, 201);
};
