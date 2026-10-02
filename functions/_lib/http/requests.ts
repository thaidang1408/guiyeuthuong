import { DATA_JSON_MAX_CHARS, UPLOAD_MAX_BYTES } from '../config.ts';
import { AppError, badRequest } from '../domain/errors.ts';
import type { CreateCardInput } from '../services/card-service.ts';

export const clientIp = (request: Request) => request.headers.get('CF-Connecting-IP') ?? 'local';

/**
 * Đọc form tạo thiệp (multipart/form-data):
 *   mau  = id mẫu thiệp, goi = id gói, data = JSON nội dung thiệp, anh = các file ảnh (theo thứ tự),
 *   nhac = file nhạc tự tải lên (không bắt buộc), giong = lời nhắn giọng nói (không bắt buộc),
 *   combo = mã combo (không bắt buộc).
 */
export async function parseCreateCardForm(request: Request): Promise<CreateCardInput> {
  const length = Number(request.headers.get('Content-Length') ?? 0);
  if (length > UPLOAD_MAX_BYTES) throw new AppError(413, 'Ảnh và nhạc tải lên nặng quá, bạn bớt ảnh hoặc chọn bài nhạc nhẹ hơn nhé.');

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw badRequest('Dữ liệu gửi lên không hợp lệ.');
  }

  const rawData = form.get('data');
  if (typeof rawData !== 'string' || rawData.length > DATA_JSON_MAX_CHARS) throw badRequest('Dữ liệu thiệp không hợp lệ.');
  let data: unknown;
  try {
    data = JSON.parse(rawData);
  } catch {
    throw badRequest('Dữ liệu thiệp không hợp lệ.');
  }

  const files = form.getAll('anh');
  if (files.length > 20) throw badRequest('Quá nhiều ảnh.');
  const images: Uint8Array[] = [];
  for (const f of files) {
    if (typeof f === 'string') throw badRequest('Ảnh không hợp lệ.');
    images.push(new Uint8Array(await f.arrayBuffer()));
  }

  const musicFile = form.get('nhac');
  if (typeof musicFile === 'string') throw badRequest('File nhạc không hợp lệ.');
  const music = musicFile ? new Uint8Array(await musicFile.arrayBuffer()) : null;

  const voiceFile = form.get('giong');
  if (typeof voiceFile === 'string') throw badRequest('Lời nhắn giọng nói không hợp lệ.');
  const voice = voiceFile ? new Uint8Array(await voiceFile.arrayBuffer()) : null;

  const combo = form.get('combo');
  const comboCode = typeof combo === 'string' && combo.trim() ? combo.slice(0, 40) : null;

  return {
    templateId: String(form.get('mau') ?? ''),
    planId: String(form.get('goi') ?? ''),
    data,
    images,
    music,
    voice,
    comboCode,
  };
}

export async function readJson(request: Request, maxChars = 4000): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length > maxChars) throw badRequest('Dữ liệu quá dài.');
  try {
    const value = JSON.parse(text);
    if (value && typeof value === 'object') return value as Record<string, unknown>;
  } catch {
    /* rơi xuống lỗi bên dưới */
  }
  throw badRequest('Dữ liệu không hợp lệ.');
}
