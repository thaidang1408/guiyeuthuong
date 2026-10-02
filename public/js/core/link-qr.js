// Vẽ mã QR của link thiệp lên canvas (để in kèm quà) và tải về dạng ảnh PNG.
// Thư viện QR chỉ được tải khi cần, trang thiệp của người nhận không phải tải.

export async function drawLinkQr(text, { size = 600, caption = '' } = {}) {
  const { default: qrcode } = await import('../vendor/qrcode-generator.js');
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();

  const modules = qr.getModuleCount();
  const quiet = 4; // viền trắng bắt buộc quanh mã QR
  const cell = Math.floor(size / (modules + quiet * 2));
  const qrSize = cell * (modules + quiet * 2);
  const captionHeight = caption ? Math.round(qrSize * 0.12) : 0;

  const canvas = document.createElement('canvas');
  canvas.width = qrSize;
  canvas.height = qrSize + captionHeight;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#4a1a2c';
  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      if (qr.isDark(r, c)) ctx.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell);
    }
  }
  if (caption) {
    ctx.font = `600 ${Math.round(captionHeight * 0.42)}px "Be Vietnam Pro", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(caption, qrSize / 2, qrSize + captionHeight * 0.45);
  }
  return canvas;
}

/** Vẽ hình trái tim (tâm ngang cx, đỉnh khuyết ở top, rộng w). */
function heartPath(ctx, cx, top, w) {
  const h = w * 0.92;
  ctx.beginPath();
  ctx.moveTo(cx, top + h * 0.25);
  ctx.bezierCurveTo(cx, top, cx - w * 0.5, top, cx - w * 0.5, top + h * 0.3);
  ctx.bezierCurveTo(cx - w * 0.5, top + h * 0.6, cx - w * 0.1, top + h * 0.78, cx, top + h);
  ctx.bezierCurveTo(cx + w * 0.1, top + h * 0.78, cx + w * 0.5, top + h * 0.6, cx + w * 0.5, top + h * 0.3);
  ctx.bezierCurveTo(cx + w * 0.5, top, cx, top, cx, top + h * 0.25);
  ctx.closePath();
}

/**
 * Thẻ in kèm quà: mã QR nằm trong một trái tim lớn, có tên người nhận.
 * Mã QR vẫn giữ khung trắng vuông bên trong để camera điện thoại quét được.
 */
export async function drawHeartQrCard(text, { to = '', from = '' } = {}) {
  const qrCanvas = await drawLinkQr(text, { size: 420 });
  await document.fonts?.ready;
  const W = 900;
  const H = 1200;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const FONT = '"Be Vietnam Pro", system-ui, sans-serif';
  const HAND = '"Dancing Script", cursive';

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#fff1f3');
  bg.addColorStop(1, '#ffe2d6');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // Vài trái tim nhỏ trang trí
  ctx.fillStyle = 'rgba(229, 72, 122, 0.12)';
  for (const [x, y, s] of [[90, 140, 70], [800, 220, 90], [120, 1040, 80], [780, 1080, 60], [460, 70, 40]]) {
    heartPath(ctx, x, y, s);
    ctx.fill();
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#4b2236';
  ctx.font = `700 76px ${HAND}`;
  ctx.fillText(to ? `Gửi ${to}` : 'Gửi bạn', W / 2, 190);

  // Trái tim lớn chứa mã QR
  const heartW = 780;
  const heartTop = 250;
  const g = ctx.createLinearGradient(0, heartTop, 0, heartTop + heartW);
  g.addColorStop(0, '#ff7096');
  g.addColorStop(1, '#e5487a');
  ctx.save();
  ctx.shadowColor = 'rgba(229, 72, 122, 0.4)';
  ctx.shadowBlur = 40;
  ctx.fillStyle = g;
  heartPath(ctx, W / 2, heartTop, heartW);
  ctx.fill();
  ctx.restore();

  const box = 400;
  const bx = (W - box) / 2;
  const by = heartTop + 175;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(bx - 14, by - 14, box + 28, box + 28, 28) : ctx.rect(bx - 14, by - 14, box + 28, box + 28);
  ctx.fill();
  ctx.drawImage(qrCanvas, bx, by, box, box);

  ctx.fillStyle = '#4b2236';
  ctx.font = `700 40px ${FONT}`;
  ctx.fillText('Quét mã để mở thiệp 💌', W / 2, 1050);
  if (from) {
    ctx.font = `600 54px ${HAND}`;
    ctx.fillStyle = '#e5487a';
    ctx.fillText(`— ${from}`, W / 2, 1125);
  }
  return canvas;
}

export function downloadCanvas(canvas, filename) {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
}
