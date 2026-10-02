// "Biên lai tình yêu": vẽ một tờ hóa đơn in nhiệt vui nhộn lên canvas để người nhận lưu/chia sẻ lên story.
// Mỗi lần được chia sẻ là một lần web được giới thiệu (có tên web ở cuối biên lai).

const W = 720;
const PAD = 56;
const INK = '#2b2b2b';
const PAPER = '#fffdf6';
const FONT = '"Be Vietnam Pro", system-ui, sans-serif';

/** Xuống dòng theo bề rộng. */
function wrapLines(ctx, text, maxWidth) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    lines.push(line);
  }
  return lines;
}

/**
 * spec: { title, subtitle?, rows: [[nhãn, giá trị]], verdict, stamp? }
 * Trả về canvas (khổ dọc, hợp đăng story).
 */
export async function drawReceipt(spec) {
  await document.fonts?.ready;
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `600 30px ${FONT}`;
  const verdictLines = wrapLines(measure, spec.verdict || '', W - PAD * 2);
  const H = 600 + spec.rows.length * 64 + verdictLines.length * 44 + (spec.stamp ? 20 : 0);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Nền hồng nhạt + tờ giấy có mép răng cưa trên/dưới
  ctx.fillStyle = '#ffe3e8';
  ctx.fillRect(0, 0, W, H);
  const left = 28;
  const right = W - 28;
  const tooth = 16;
  ctx.beginPath();
  ctx.moveTo(left, 24 + tooth);
  for (let x = left; x < right; x += tooth * 2) ctx.lineTo(x + tooth, 24), ctx.lineTo(Math.min(right, x + tooth * 2), 24 + tooth);
  ctx.lineTo(right, H - 24 - tooth);
  for (let x = right; x > left; x -= tooth * 2) ctx.lineTo(x - tooth, H - 24), ctx.lineTo(Math.max(left, x - tooth * 2), H - 24 - tooth);
  ctx.closePath();
  ctx.shadowColor = 'rgba(74, 26, 44, 0.18)';
  ctx.shadowBlur = 24;
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.shadowColor = 'transparent';

  const center = (text, y, font, color = INK) => {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(text, W / 2, y);
  };
  const dashed = (y) => {
    ctx.strokeStyle = '#bbb';
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(W - PAD, y);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  let y = 110;
  center('💌', y, `48px ${FONT}`);
  y += 64;
  center(spec.title, y, `800 40px ${FONT}`);
  y += 40;
  center(spec.subtitle || new Date().toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }), y, `400 24px ${FONT}`, '#777');
  y += 36;
  dashed(y);
  y += 56;

  for (const [label, value] of spec.rows) {
    ctx.font = `400 28px ${FONT}`;
    ctx.fillStyle = '#555';
    ctx.textAlign = 'left';
    ctx.fillText(label, PAD, y);
    ctx.font = `700 28px ${FONT}`;
    ctx.fillStyle = INK;
    ctx.textAlign = 'right';
    ctx.fillText(String(value), W - PAD, y);
    y += 64;
  }
  dashed(y - 24);
  y += 36;
  center('KẾT LUẬN', y, `800 24px ${FONT}`, '#e5487a');
  y += 48;
  for (const line of verdictLines) {
    center(line, y, `600 30px ${FONT}`);
    y += 44;
  }
  if (spec.stamp) {
    ctx.save();
    ctx.translate(W - 170, y - 10);
    ctx.rotate(-0.22);
    ctx.strokeStyle = '#d62828';
    ctx.lineWidth = 4;
    ctx.font = `800 30px ${FONT}`;
    const w = ctx.measureText(spec.stamp).width + 28;
    ctx.strokeRect(-w / 2, -30, w, 48);
    ctx.fillStyle = '#d62828';
    ctx.textAlign = 'center';
    ctx.fillText(spec.stamp, 0, 6);
    ctx.restore();
  }
  y += 40;
  dashed(y);
  y += 50;
  center('Cảm ơn quý khách đã thương 💗', y, `400 24px ${FONT}`, '#777');
  y += 40;
  center('Tạo thiệp của bạn: guiyeuthuong.pages.dev', y, `700 24px ${FONT}`, '#e5487a');
  return canvas;
}

/** "1 phút 12 giây" */
export function formatDuration(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} giây`;
  const m = Math.floor(s / 60);
  return `${m} phút ${s % 60} giây`;
}
