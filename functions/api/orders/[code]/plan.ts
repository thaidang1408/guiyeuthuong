// POST /api/orders/<mã đơn>/plan — đổi gói. Body: { plan, slug, editToken }
import { buildServices } from '../../../_lib/container.ts';
import type { Env } from '../../../_lib/env.ts';
import { readJson } from '../../../_lib/http/requests.ts';
import { json } from '../../../_lib/http/responses.ts';

export const onRequestPost: PagesFunction<Env> = async ({ request, params, env }) => {
  const body = await readJson(request);
  return json(await buildServices(env).orderService.changePlan(String(params.code), body.plan, body.slug, body.editToken));
};
