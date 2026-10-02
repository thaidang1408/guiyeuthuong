// GET /api/giong-noi/<slug> — lời nhắn giọng nói của thiệp (đã tới giờ mở).
import { buildServices } from '../../_lib/container.ts';
import type { Env } from '../../_lib/env.ts';
import { json, mediaResponse } from '../../_lib/http/responses.ts';

export const onRequestGet: PagesFunction<Env> = async ({ request, params, env }) => {
  const voice = await buildServices(env).extrasService.getVoice(String(params.slug));
  if (!voice) return json({ error: 'Không tìm thấy lời nhắn giọng nói.' }, 404);
  return mediaResponse(request, voice, 'public, max-age=86400');
};
