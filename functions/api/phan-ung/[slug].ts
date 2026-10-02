// POST /api/phan-ung/<slug> { noPresses, thinkMs } — người nhận vừa bấm "Có"/"Tha"/hoàn thành.
import { buildServices } from '../../_lib/container.ts';
import type { Env } from '../../_lib/env.ts';
import { clientIp, readJson } from '../../_lib/http/requests.ts';
import { json } from '../../_lib/http/responses.ts';

export const onRequestPost: PagesFunction<Env> = async ({ request, params, env }) => {
  await buildServices(env).responseService.react(String(params.slug), await readJson(request, 200), clientIp(request));
  return json({ ok: true });
};
