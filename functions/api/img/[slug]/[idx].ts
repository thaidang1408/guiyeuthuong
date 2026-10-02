// GET /api/img/<slug>/<idx>[?don=<mã đơn>] — trả ảnh của thiệp.
import { buildServices } from '../../../_lib/container.ts';
import type { Env } from '../../../_lib/env.ts';
import { json } from '../../../_lib/http/responses.ts';

export const onRequestGet: PagesFunction<Env> = async ({ request, params, env }) => {
  const orderCode = new URL(request.url).searchParams.get('don');
  const image = await buildServices(env).cardService.getImage(String(params.slug), Number(params.idx), orderCode);
  if (!image) return json({ error: 'Không tìm thấy ảnh.' }, 404);
  return new Response(image.data, {
    headers: {
      'Content-Type': image.mime,
      // Ảnh của một thiệp không bao giờ đổi nên cho trình duyệt giữ lâu.
      'Cache-Control': orderCode ? 'private, no-store' : 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex',
    },
  });
};
