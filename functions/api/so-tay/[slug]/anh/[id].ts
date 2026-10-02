// GET /api/so-tay/<slug>/anh/<id> — ảnh của một trang trong sổ tình yêu chung.
import { buildServices } from '../../../../_lib/container.ts';
import type { Env } from '../../../../_lib/env.ts';
import { json } from '../../../../_lib/http/responses.ts';

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const img = await buildServices(env).extrasService.getMemoryImage(String(params.slug), Number(params.id));
  if (!img) return json({ error: 'Không tìm thấy ảnh.' }, 404);
  return new Response(img.data, {
    headers: { 'Content-Type': img.mime, 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' },
  });
};
