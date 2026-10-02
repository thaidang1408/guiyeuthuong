// Chép thư viện vẽ mã QR (qrcode-generator, giấy phép MIT) từ node_modules sang public/js/vendor/
// dưới dạng ES module để trình duyệt import trực tiếp, không cần bước build.
// Chạy lại sau khi `npm update qrcode-generator`: node scripts/cap-nhat-thu-vien.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('node_modules/qrcode-generator/qrcode.js', 'utf8');
const umdStart = src.lastIndexOf('(function (factory) {');
if (umdStart < 0) throw new Error('Không tìm thấy đoạn UMD, thư viện đã đổi cấu trúc');
const version = JSON.parse(readFileSync('node_modules/qrcode-generator/package.json', 'utf8')).version;
writeFileSync(
  'public/js/vendor/qrcode-generator.js',
  `// qrcode-generator ${version} — tự sinh bởi scripts/cap-nhat-thu-vien.mjs, đừng sửa tay.\n` +
    src.slice(0, umdStart) +
    'export default qrcode;\n',
);
console.log(`Đã tạo public/js/vendor/qrcode-generator.js (v${version})`);
