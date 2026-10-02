// POST /api/dap-lai/<slug> { text } — người nhận viết thư đáp lại người gửi.
import { buildServices } from '../../_lib/container.ts';
import type { Env } from '../../_lib/env.ts';
import { clientIp, readJson } from '../../_lib/http/requests.ts';
import { json } from '../../_lib/http/responses.ts';

export const onRequestPost: PagesFunction<Env> = async ({ request, params, env }) => {
  const body = await readJson(request, 2000);
  await buildServices(env).responseService.reply(String(params.slug), body.text, clientIp(request));
  return json({ ok: true }, 201);
};
