// /api/so-tay/<slug> — sổ tình yêu chung.
//   GET     danh sách trang kỷ niệm
//   POST    viết thêm một trang (multipart: tac-gia = gui|nhan, chu = nội dung, anh = 1 ảnh đã nén, không bắt buộc)
//   DELETE  người tạo xóa một trang: ?id=<số>, cần Authorization: Bearer <mã sửa>
import { MEMORY_BOOK } from '../../../public/js/shared/extras.js';
import { buildServices } from '../../_lib/container.ts';
import type { Env } from '../../_lib/env.ts';
import { AppError, badRequest } from '../../_lib/domain/errors.ts';
import { clientIp } from '../../_lib/http/requests.ts';
import { json } from '../../_lib/http/responses.ts';

const tokenOf = (request: Request) => request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  return json({ memories: await buildServices(env).extrasService.listMemories(String(params.slug)) });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, params, env }) => {
  if (Number(request.headers.get('Content-Length') ?? 0) > MEMORY_BOOK.imageMaxBytes + 16 * 1024) throw new AppError(413, 'Ảnh nặng quá.');
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw badRequest('Dữ liệu gửi lên không hợp lệ.');
  }
  const file = form.get('anh');
  if (typeof file === 'string') throw badRequest('Ảnh không hợp lệ.');
  const image = file ? new Uint8Array(await file.arrayBuffer()) : null;
  const memories = await buildServices(env).extrasService.addMemory(
    String(params.slug),
    { author: form.get('tac-gia'), text: form.get('chu'), image },
    clientIp(request),
  );
  return json({ memories }, 201);
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, params, env }) => {
  const id = Number(new URL(request.url).searchParams.get('id'));
  await buildServices(env).extrasService.deleteMemory(String(params.slug), tokenOf(request), id);
  return json({ ok: true });
};
