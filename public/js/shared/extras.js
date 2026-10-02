// GIỚI HẠN cho các tính năng ghi âm/ghi hình và sổ tình yêu chung — dùng chung cho trình duyệt và server.

/** Lời nhắn giọng nói: tối đa 60 giây, 1MB (ghi ở 48kbps thì 60 giây chỉ khoảng 360KB). */
export const VOICE = { maxSeconds: 60, maxBytes: 1024 * 1024, bitsPerSecond: 48_000 };

/** Video phản ứng của người nhận: 15 giây, hình nhỏ, tối đa 3MB. */
export const REACTION = { seconds: 15, maxBytes: 3 * 1024 * 1024, videoBitsPerSecond: 900_000, audioBitsPerSecond: 48_000 };

/** "Mở cùng nhau": coi là đang chờ nếu báo sẵn sàng trong ngần này; đếm ngược trước khi cùng mở. */
export const TOGETHER = { freshMs: 8000, pollMs: 2000, countdownMs: 4000, maxWaitMs: 15 * 60 * 1000 };

/** Sổ tình yêu chung: độ dài mỗi trang, số trang tối đa, dung lượng ảnh (đã nén ở trình duyệt). */
export const MEMORY_BOOK = { textMax: 400, maxEntries: 120, imageMaxBytes: 350 * 1024 };

/**
 * Nhận diện file ghi âm/ghi hình bằng "chữ ký" đầu file (không tin đuôi file).
 * Trình duyệt Android/Chrome ghi ra WebM, iPhone/Safari ghi ra MP4. kind: 'audio' | 'video'.
 * @param {Uint8Array} b
 * @param {'audio'|'video'} kind
 */
export function detectRecordingMime(b, kind) {
  if (!b || b.length < 12) return null;
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return `${kind}/webm`;
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return `${kind}/mp4`;
  if (kind === 'audio' && b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) return 'audio/ogg';
  return null;
}

/** Định dạng ghi tốt nhất trình duyệt này hỗ trợ (ưu tiên MP4 vì iPhone phát được). */
export function pickRecorderType(kind) {
  if (typeof MediaRecorder === 'undefined') return null;
  const list =
    kind === 'audio'
      ? ['audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
      : ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return list.find((t) => MediaRecorder.isTypeSupported?.(t)) || null;
}
