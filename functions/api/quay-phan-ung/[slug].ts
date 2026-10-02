// /api/quay-phan-ung/<slug> — video phản ứng của người nhận.
//   POST  người nhận gửi video (thân yêu cầu là file video, tối đa 3MB) — chỉ khi họ tự đồng ý quay và bấm gửi
//   GET   người tạo xem video, cần Authorization: Bearer <mã sửa>
import { REACTION } from '../../../public/js/shared/extras.js';
import { buildServices } from '../../_lib/container.ts';
import type { Env } from '../../_lib/env.ts';
import { AppError } from '../../_lib/domain/errors.ts';
import { clientIp } from '../../_lib/http/requests.ts';
import { json, mediaResponse } from '../../_lib/http/responses.ts';

const tokenOf = (request: Request) => request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';

export const onRequestPost: PagesFunction<Env> = async ({ request, params, env }) => {
  if (Number(request.headers.get('Content-Length') ?? 0) > REACTION.maxBytes) throw new AppError(413, 'Video dài quá.');
  const bytes = new Uint8Array(await request.arrayBuffer());
  await buildServices(env).extrasService.uploadReaction(String(params.slug), bytes, clientIp(request));
  return json({ ok: true }, 201);
};

export const onRequestGet: PagesFunction<Env> = async ({ request, params, env }) => {
  const video = await buildServices(env).extrasService.getReaction(String(params.slug), tokenOf(request));
  if (!video) return json({ error: 'Chưa có video phản ứng.' }, 404);
  return mediaResponse(request, video, 'private, no-store');
};
