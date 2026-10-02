// Khung "Mã combo của bạn": hiện mã (tính từ mã sửa thiệp), số lượt còn lại, cách dùng.
// Dùng ở trang thanh toán thành công và trang quản lý của thiệp mua combo.
import { checkCombo } from '../core/api.js';
import { copyText, el } from '../core/dom.js';
import { comboCodeFromEditToken, formatComboCode } from '../shared/combo.js';

export function comboPanel(editToken) {
  const codeBox = el('p', { class: 'combo-code', text: '…' });
  const status = el('p', { class: 'small', attrs: { 'aria-live': 'polite' }, text: 'Đang kiểm tra số lượt…' });
  const copyBtn = el('button', { class: 'btn btn-soft btn-sm', text: 'Sao chép mã', attrs: { type: 'button' } });
  const panel = el('section', { class: 'panel combo-panel' }, [
    el('h2', { text: '🎟️ Mã combo của bạn' }),
    codeBox,
    status,
    el('div', { class: 'share-actions' }, [copyBtn, el('a', { class: 'btn btn-primary btn-sm', text: 'Tạo thiệp tiếp theo', attrs: { href: '/#mau-thiep' } })]),
    el('p', {
      class: 'muted small',
      text: 'Cách dùng: chọn mẫu → làm thiệp → bấm "Lấy link thiệp" → "Đã có mã combo?" → dán mã. Thiệp có link ngay, không cần chuyển khoản. Mã này cũng luôn có trong trang quản lý.',
    }),
  ]);

  comboCodeFromEditToken(editToken).then(async (code) => {
    const pretty = formatComboCode(code);
    codeBox.textContent = pretty;
    copyBtn.addEventListener('click', () => copyText(pretty));
    try {
      const s = await checkCombo(code);
      status.textContent = !s.paid
        ? 'Combo chưa được thanh toán.'
        : s.remaining > 0
          ? `Còn ${s.remaining}/${s.total - 1} lượt tạo thiệp miễn phí (thiệp này là thiệp thứ nhất).`
          : `Đã dùng hết ${s.total} thiệp của combo. Cảm ơn bạn nhiều 💛`;
    } catch (e) {
      status.textContent = e.message;
    }
  });
  return panel;
}
