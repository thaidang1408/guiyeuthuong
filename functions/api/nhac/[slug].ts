// GET /api/nhac/<slug> — bài nhạc tự tải lên của thiệp đang hoạt động.
// Hỗ trợ "Range" vì Safari trên iPhone chỉ phát nhạc khi server trả được từng đoạn file.
import { buildServices } from '../../_lib/container.ts';
import { parseRange } from '../../_lib/domain/audio.ts';
import type { Env } from '../../_lib/env.ts';
import { json } from '../../_lib/http/responses.ts';

export const onRequestGet: PagesFunction<Env> = async ({ request, params, env }) => {
  const music = await buildServices(env).cardService.getMusic(String(params.slug));
  if (!music) return json({ error: 'Không tìm thấy nhạc.' }, 404);

  const size = music.data.length;
  const headers: Record<string, string> = {
    'Content-Type': music.mime,
    'Accept-Ranges': 'bytes',
    // Nhạc của một thiệp không đổi, nhưng thiệp có thể hết hạn/bị gỡ nên chỉ cho giữ 1 ngày.
    'Cache-Control': 'public, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex',
  };
  const range = parseRange(request.headers.get('Range'), size);
  if (range === 'invalid') return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } });
  if (!range) return new Response(music.data, { headers: { ...headers, 'Content-Length': String(size) } });
  return new Response(music.data.subarray(range.start, range.end + 1), {
    status: 206,
    headers: { ...headers, 'Content-Range': `bytes ${range.start}-${range.end}/${size}`, 'Content-Length': String(range.end - range.start + 1) },
  });
};
