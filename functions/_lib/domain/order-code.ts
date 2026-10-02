const ORDER_CODE_IN_TEXT = /TX[A-Z2-9]{4}/i;

/**
 * Tìm mã đơn trong nội dung chuyển khoản. Ngân hàng có thể đổi hoa/thường
 * hoặc chèn thêm ký tự, nên tìm ở bất kỳ vị trí nào và trả về dạng chữ hoa.
 */
export function extractOrderCode(...texts: Array<string | null | undefined>): string | null {
  for (const text of texts) {
    if (!text) continue;
    const match = String(text).match(ORDER_CODE_IN_TEXT);
    if (match) return match[0].toUpperCase();
  }
  return null;
}
