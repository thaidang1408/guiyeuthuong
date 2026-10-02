import { IMAGE_MAX_BYTES } from '../config.ts';
import { badRequest } from './errors.ts';
import type { Plan } from './plans.ts';

export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

export interface ImageUpload {
  mime: ImageMime;
  bytes: Uint8Array;
}

/** Nhận diện loại ảnh bằng "chữ ký" ở đầu file, không tin phần đuôi hay khai báo của trình duyệt. */
export function detectImageMime(b: Uint8Array): ImageMime | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) return 'image/png';
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // RIFF
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 // WEBP
  ) return 'image/webp';
  return null;
}

/** Kiểm tra danh sách ảnh theo gói: số lượng, dung lượng, loại file. */
export function validateImages(files: Uint8Array[], plan: Plan): ImageUpload[] {
  if (files.length > plan.maxImages) {
    throw badRequest(`Gói ${plan.name} chỉ cho tối đa ${plan.maxImages} ảnh.`);
  }
  return files.map((bytes, i) => {
    if (bytes.length === 0) throw badRequest(`Ảnh số ${i + 1} bị trống.`);
    if (bytes.length > IMAGE_MAX_BYTES) {
      throw badRequest(`Ảnh số ${i + 1} quá nặng (tối đa ${Math.round(IMAGE_MAX_BYTES / 1024)}KB).`);
    }
    const mime = detectImageMime(bytes);
    if (!mime) throw badRequest(`Ảnh số ${i + 1} không phải JPG, PNG hoặc WebP.`);
    return { mime, bytes };
  });
}
