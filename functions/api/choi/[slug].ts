// POST /api/choi/<slug> { kind: 'vong-quay' } | { kind: 'cau-do', answers: number[] } — trò chơi cuối thiệp.
import { buildServices } from '../../_lib/container.ts';
import type { Env } from '../../_lib/env.ts';
import { clientIp, readJson } from '../../_lib/http/requests.ts';
import { json } from '../../_lib/http/responses.ts';

export const onRequestPost: PagesFunction<Env> = async ({ request, params, env }) => {
  const body = await readJson(request, 1000);
  const result = await buildServices(env).responseService.play(String(params.slug), body, clientIp(request));
  return json(result);
};
