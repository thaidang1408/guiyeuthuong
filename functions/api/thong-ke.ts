// GET /api/thong-ke — số thiệp đã gửi (số thật, đếm sẵn trong bảng stats) cho trang chủ.
import { buildServices } from '../_lib/container.ts';
import type { Env } from '../_lib/env.ts';
import { json } from '../_lib/http/responses.ts';

export const onRequestGet: PagesFunction<Env> = async ({ env }) =>
  json({ cardsSent: await buildServices(env).stats.get('cards_sent') }, 200, { 'Cache-Control': 'public, max-age=300' });
