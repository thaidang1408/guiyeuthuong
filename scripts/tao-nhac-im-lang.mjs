// Tạo 5 file nhạc im lặng làm chỗ trống: public/music/nhac-1.mp3 … nhac-5.mp3
// Chạy: node scripts/tao-nhac-im-lang.mjs
// Sau này chủ dự án thay bằng nhạc thật tải từ Pixabay Music (giữ nguyên tên file).
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

// Một khung MP3 (MPEG-1 Layer III, 128kbps, 44.1kHz) toàn số 0 = im lặng. Mỗi khung dài 417 byte, ~26ms.
const FRAME_SIZE = 417;
const frame = new Uint8Array(FRAME_SIZE);
frame.set([0xff, 0xfb, 0x90, 0x64]);
const SECONDS = 2;
const frames = Math.ceil((SECONDS * 44100) / 1152);
const file = new Uint8Array(FRAME_SIZE * frames);
for (let i = 0; i < frames; i++) file.set(frame, i * FRAME_SIZE);

mkdirSync('public/music', { recursive: true });
for (let n = 1; n <= 5; n++) {
  const path = `public/music/nhac-${n}.mp3`;
  if (existsSync(path) && !process.argv.includes('--ghi-de')) {
    console.log(`Bỏ qua ${path} (đã có, thêm --ghi-de để ghi đè)`);
    continue;
  }
  writeFileSync(path, file);
  console.log(`Đã tạo ${path}`);
}
