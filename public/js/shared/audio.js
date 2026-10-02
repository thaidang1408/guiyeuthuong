// NHẠC TỰ TẢI LÊN — dùng chung cho trình tạo (trình duyệt) và kiểm tra ở server.

/** Mã nhạc khi người tạo dùng bài nhạc của chính họ. */
export const CUSTOM_MUSIC_ID = 'tu-tai';

/** Dung lượng tối đa của bài nhạc tự tải lên (4MB ≈ 4 phút ở chất lượng 128kbps). */
export const MUSIC_MAX_BYTES = 4 * 1024 * 1024;

/**
 * Nhận diện loại file nhạc bằng "chữ ký" ở đầu file (không tin đuôi file).
 * Nhận MP3, M4A/AAC và OGG — đều phát được trên điện thoại. Trả null nếu không phải nhạc.
 * @param {Uint8Array} b
 */
export function detectAudioMime(b) {
  if (b.length < 12) return null;
  // MP3 có thẻ ID3 ở đầu
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return 'audio/mpeg';
  // M4A: "ftyp" ở byte thứ 4
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'audio/mp4';
  // OGG
  if (b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) return 'audio/ogg';
  // Khung âm thanh không có thẻ: MP3 (layer khác 0) hoặc AAC dạng ADTS (layer = 0)
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return (b[1] & 0x06) === 0 ? 'audio/aac' : 'audio/mpeg';
  return null;
}
