// Nén ảnh trên trình duyệt (server không xử lý ảnh): cạnh dài ≤ 1280px, dung lượng ≤ 300KB.

const MAX_SIDE = 1280;
const MAX_BYTES = 300 * 1024;
const QUALITIES = [0.8, 0.72, 0.64, 0.56, 0.48, 0.4];

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không đọc được ảnh này, bạn chọn ảnh khác nhé.'));
    };
    img.src = url;
  });
}

const toBlob = (canvas, type, quality) => new Promise((r) => canvas.toBlob(r, type, quality));

let webpSupported;
async function outputType() {
  if (webpSupported === undefined) {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const b = await toBlob(c, 'image/webp', 0.8);
    webpSupported = b?.type === 'image/webp';
  }
  return webpSupported ? 'image/webp' : 'image/jpeg';
}

/** Trả về Blob ảnh đã nén. Trình duyệt hiện đại tự xoay ảnh theo EXIF khi vẽ lên canvas. */
export async function compressImage(file) {
  const img = await loadImage(file);
  const type = await outputType();
  let scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  try {
    for (let round = 0; round < 4; round++) {
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      ctx.fillStyle = '#fff'; // nền trắng cho ảnh PNG trong suốt khi đổi sang JPEG
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      for (const q of QUALITIES) {
        const blob = await toBlob(canvas, type, q);
        if (blob && blob.size <= MAX_BYTES) return blob;
      }
      scale *= 0.75; // vẫn nặng thì thu nhỏ thêm
    }
    throw new Error('Ảnh này nặng quá, bạn chọn ảnh khác nhé.');
  } finally {
    canvas.width = canvas.height = 0; // giải phóng bộ nhớ trên điện thoại yếu
  }
}
