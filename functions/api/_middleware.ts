// Bắt mọi lỗi của /api/* ở một chỗ và trả JSON thân thiện.
import type { Env } from '../_lib/env.ts';
import { errorResponse } from '../_lib/http/responses.ts';

export const onRequest: PagesFunction<Env> = async ({ next }) => {
  try {
    return await next();
  } catch (e) {
    return errorResponse(e);
  }
};
