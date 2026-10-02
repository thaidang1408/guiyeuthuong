import { MUSIC_MAX_BYTES, detectAudioMime } from '../../../public/js/shared/audio.js';
import { badRequest } from './errors.ts';

export interface AudioUpload {
  mime: string;
  bytes: Uint8Array;
}

/** Kiểm tra bài nhạc tự tải lên: dung lượng và loại file. */
export function validateAudio(bytes: Uint8Array): AudioUpload {
  if (bytes.length === 0) throw badRequest('File nhạc bị trống.');
  if (bytes.length > MUSIC_MAX_BYTES) {
    throw badRequest(`Bài nhạc nặng quá (tối đa ${Math.round(MUSIC_MAX_BYTES / 1024 / 1024)}MB).`);
  }
  const mime = detectAudioMime(bytes);
  if (!mime) throw badRequest('File nhạc phải là MP3, M4A hoặc OGG.');
  return { mime, bytes };
}

/** Byte cần trả cho một yêu cầu "Range: bytes=a-b" (điện thoại iPhone cần để phát nhạc). */
export function parseRange(header: string | null, size: number): { start: number; end: number } | 'invalid' | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === '' && m[2] === '')) return 'invalid';
  let start: number;
  let end: number;
  if (m[1] === '') {
    // "bytes=-500": 500 byte cuối
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start > end || start >= size) return 'invalid';
  return { start, end };
}
