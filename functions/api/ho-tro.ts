// GET /api/ho-tro — thông tin liên hệ hỗ trợ (số Zalo lấy từ biến môi trường SUPPORT_ZALO).
import type { Env } from '../_lib/env.ts';
import { json } from '../_lib/http/responses.ts';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const zalo = (env.SUPPORT_ZALO ?? '').replace(/[^\d]/g, '');
  return json({ zalo: zalo.length >= 9 ? zalo : null }, 200, { 'Cache-Control': 'public, max-age=300' });
};
