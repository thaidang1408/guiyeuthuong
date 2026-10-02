// KIỂU CHỮ cho lời nhắn, tên, chữ ký trên thiệp (dùng chung cho trình duyệt và server).
// Đều là font Google có đủ dấu tiếng Việt (đã kiểm tra hiển thị). Thêm kiểu mới: thêm một dòng ở FONTS.
//   family: tên font; query: phần "family=…" để tải từ Google Fonts (null = đã có sẵn trên mọi trang).

export const FONTS = [
  { id: 'mem-mai', name: 'Mềm mại', hint: 'Viết tay lãng mạn', family: 'Dancing Script', query: null },
  { id: 'sang-trong', name: 'Sang trọng', hint: 'Hợp 20/10, cô giáo, mẹ', family: 'Playfair Display', query: 'Playfair+Display:ital,wght@1,600' },
  { id: 'de-thuong', name: 'Dễ thương', hint: 'Bạn thân, xin lỗi, rủ đi chơi', family: 'Pangolin', query: 'Pangolin' },
  { id: 'tron-tria', name: 'Tròn trịa', hint: 'Nổi bật, vui tươi', family: 'Pacifico', query: 'Pacifico' },
  { id: 'nhat-ky', name: 'Nhật ký', hint: 'Như tự tay viết', family: 'Mynerve', query: 'Mynerve' },
  { id: 'but-muc', name: 'Bút mực', hint: 'Thư tay cổ điển', family: 'Charm', query: 'Charm:wght@700' },
  { id: 'de-doc', name: 'Dễ đọc', hint: 'Gửi bố mẹ, ông bà', family: 'Be Vietnam Pro', query: null },
];

/** Kiểu chữ gợi ý sẵn cho từng mẫu (bản nháp mới). Mẫu không có trong đây dùng "Mềm mại". */
const TEMPLATE_FONT = {
  'phu-nu-2010': 'sang-trong',
  'xin-loi': 'de-thuong',
  'ca-nhom': 'de-thuong',
  'mo-khi': 'nhat-ky',
  'sinh-nhat': 'tron-tria',
  'di-choi': 'de-thuong',
};

const IDS = new Set(FONTS.map((f) => f.id));

export const defaultFont = (templateId) => TEMPLATE_FONT[templateId] || 'mem-mai';

/** id hợp lệ thì giữ, không thì '' (= kiểu mặc định "Mềm mại", giống các thiệp cũ). */
export const pickFont = (id) => (typeof id === 'string' && IDS.has(id) ? id : '');

export const fontInfo = (id) => FONTS.find((f) => f.id === id) || FONTS[0];

/** Chuỗi font-family dùng cho CSS/canvas, có font dự phòng. */
export const fontStack = (id) => `'${fontInfo(id).family}', 'Dancing Script', 'Be Vietnam Pro', cursive`;
