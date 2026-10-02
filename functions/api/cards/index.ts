// POST /api/cards — tạo thiệp nháp + đơn chờ thanh toán.
import { buildServices } from '../../_lib/container.ts';
import type { Env } from '../../_lib/env.ts';
import { clientIp, parseCreateCardForm } from '../../_lib/http/requests.ts';
import { json } from '../../_lib/http/responses.ts';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const input = await parseCreateCardForm(request);
  const result = await buildServices(env).cardService.createCard(input, clientIp(request));
  return json(result, 201);
};
