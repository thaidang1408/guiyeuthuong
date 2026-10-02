// "Thiệp của tôi": ghi nhớ các thiệp đã thanh toán ngay trên trình duyệt này (localStorage),
// để người tạo lỡ mất link quản lý vẫn mở lại được. Không gửi gì lên server.
const KEY = 'thiep-cua-toi';
const MAX = 50;

export function listMyCards() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list.filter((c) => c && typeof c.slug === 'string' && typeof c.editToken === 'string') : [];
  } catch {
    return [];
  }
}

/** card: { slug, editToken, recipientName, template, plan } — thiệp mới nhất lên đầu, không trùng. */
export function rememberMyCard(card) {
  if (!card?.slug || !card?.editToken) return;
  const old = listMyCards().find((c) => c.slug === card.slug);
  const entry = { ...old, ...card, savedAt: old?.savedAt || Date.now() };
  const list = [entry, ...listMyCards().filter((c) => c.slug !== card.slug)].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* trình duyệt chặn lưu trữ: bỏ qua */
  }
}

export function forgetMyCard(slug) {
  try {
    localStorage.setItem(KEY, JSON.stringify(listMyCards().filter((c) => c.slug !== slug)));
  } catch {
    /* bỏ qua */
  }
}

/** Đánh dấu người tạo đã tự lưu link quản lý ở nơi khác (Zalo, ghi chú…). */
export function markManageSaved(slug) {
  const card = listMyCards().find((c) => c.slug === slug);
  if (card) rememberMyCard({ ...card, saved: true });
}
