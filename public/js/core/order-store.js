// Ghi nhớ đơn vừa tạo trên máy người tạo: { slug, editToken, template }.
// Server không bao giờ trả lại slug/mã sửa theo mã đơn (để người lạ không dò được),
// nên trang thanh toán đọc chúng từ phần # của đường dẫn hoặc từ localStorage.

const key = (code) => `don:${code}`;

export function saveOrderInfo(code, info) {
  try {
    localStorage.setItem(key(code), JSON.stringify(info));
  } catch {
    /* trình duyệt chặn lưu trữ: vẫn còn phần # trên đường dẫn */
  }
}

/** Phần # có dạng "<slug>.<editToken>". */
export function encodeOrderHash({ slug, editToken }) {
  return `${slug}.${editToken}`;
}

export function loadOrderInfo(code) {
  const [slug, editToken] = decodeURIComponent(location.hash.slice(1)).split('.');
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(key(code)) || 'null');
  } catch {
    stored = null;
  }
  if (slug && editToken) return { ...stored, slug, editToken };
  return stored;
}

export const cardLink = (slug) => `${location.origin}/t/${slug}`;
export const manageLink = (slug, editToken) => `${location.origin}/quan-ly/${slug}#${editToken}`;
