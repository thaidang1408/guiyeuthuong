// POST /api/combo { code } — mã combo còn bao nhiêu lượt (mã gửi trong body, không nằm trên đường dẫn).
import { buildServices } from '../_lib/container.ts';
import type { Env } from '../_lib/env.ts';
import { clientIp, readJson } from '../_lib/http/requests.ts';
import { json } from '../_lib/http/responses.ts';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson(request, 200);
  return json(await buildServices(env).cardService.comboStatus(body.code, clientIp(request)));
};
