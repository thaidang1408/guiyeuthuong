// POST /api/sticker/<slug> { id } — người nhận thả một sticker đáp lại người gửi.
import { buildServices } from '../../_lib/container.ts';
import type { Env } from '../../_lib/env.ts';
import { clientIp, readJson } from '../../_lib/http/requests.ts';
import { json } from '../../_lib/http/responses.ts';

export const onRequestPost: PagesFunction<Env> = async ({ request, params, env }) => {
  const body = await readJson(request, 200);
  await buildServices(env).responseService.sticker(String(params.slug), body.id, clientIp(request));
  return json({ ok: true }, 201);
};
