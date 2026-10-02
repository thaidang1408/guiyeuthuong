// Gọi API server. Lỗi trả về luôn có câu tiếng Việt để hiện cho người dùng.

async function request(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch {
    throw new Error('Mạng đang chập chờn, bạn thử lại nhé.');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Có lỗi xảy ra, bạn thử lại sau nhé.');
  return body;
}

/** Gửi thiệp lên server. images: mảng Blob đã nén, theo thứ tự hiển thị. */
/** comboCode: có thì thiệp được kích hoạt ngay bằng lượt combo (không cần thanh toán). */
export function createCard({ template, plan, data, images, music, voice, comboCode }) {
  const form = new FormData();
  form.append('mau', template);
  form.append('goi', plan);
  form.append('data', JSON.stringify(data));
  images.forEach((blob, i) => form.append('anh', blob, `anh-${i}`));
  if (music) form.append('nhac', music, 'nhac');
  if (voice) form.append('giong', voice, 'giong');
  if (comboCode) form.append('combo', comboCode);
  return request('/api/cards', { method: 'POST', body: form });
}

export function reportCard(slug, reason) {
  return request('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, reason }),
  });
}

export const getOrder = (code) => request(`/api/orders/${encodeURIComponent(code)}`);

/** Thiệp Cơ bản đang hoạt động: tạo đơn nâng cấp lên Đặc biệt. */
export const createUpgrade = (slug, token) =>
  request(`/api/manage/${encodeURIComponent(slug)}/nang-cap`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });

export function changePlan(code, plan, { slug, editToken }) {
  return request(`/api/orders/${encodeURIComponent(code)}/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan, slug, editToken }),
  });
}

export const getManage = (slug, token) =>
  request(`/api/manage/${encodeURIComponent(slug)}`, { headers: { Authorization: `Bearer ${token}` } });

export function updateManage(slug, token, data) {
  return request(`/api/manage/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/** Chỉ chạy ở máy: giả lập SePay báo tiền về. mode: "du" (đủ tiền) | "thieu" (thiếu tiền). */
export function simulatePayment(code, mode) {
  return request('/api/dev/gia-lap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, mode }),
  });
}

/** Mã combo còn mấy lượt: { total, used, remaining, paid }. */
export const checkCombo = (code) =>
  request('/api/combo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });

/** Người nhận trả lời thiệp "Đi chơi": { date: 'YYYY-MM-DD', food, note }. */
export const submitAnswer = (slug, answer) =>
  request(`/api/tra-loi/${encodeURIComponent(slug)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(answer),
  });

const postJson = (url, body, headers = {}) =>
  request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

/** Người nhận vừa bấm "Có"/"Tha"…: { noPresses, thinkMs }. */
export const reactCard = (slug, stats) => postJson(`/api/phan-ung/${encodeURIComponent(slug)}`, stats);

/** Thư đáp lại của người nhận. */
export const replyCard = (slug, text) => postJson(`/api/dap-lai/${encodeURIComponent(slug)}`, { text });
export const sendSticker = (slug, id) => postJson(`/api/sticker/${encodeURIComponent(slug)}`, { id });

/** Trang ký tên thiệp nhóm. */
export const groupInfo = (slug, token) => postJson(`/api/ky/${encodeURIComponent(slug)}`, { token, action: 'info' });
export const signGroup = (slug, token, sig) => postJson(`/api/ky/${encodeURIComponent(slug)}`, { token, action: 'sign', ...sig });

/** Người tổ chức xóa một lời chúc. */
export const deleteSignature = (slug, editToken, id) =>
  postJson(`/api/manage/${encodeURIComponent(slug)}/xoa-chu-ky`, { id }, { Authorization: `Bearer ${editToken}` });

/** Số thiệp đã gửi (số thật). */
export const getStats = () => request('/api/thong-ke');

/** Trò chơi cuối thiệp: { kind: 'vong-quay' } hoặc { kind: 'cau-do', answers }. */
export const playGame = (slug, body) => postJson(`/api/choi/${encodeURIComponent(slug)}`, body);

/** "Mở cùng nhau": báo mình sẵn sàng; người tạo (side 'gui') kèm mã sửa. Trả { otherReady, startAt, serverNow }. */
export const togetherPing = (slug, side, editToken) =>
  postJson(`/api/cung-mo/${encodeURIComponent(slug)}`, { side }, editToken ? { Authorization: `Bearer ${editToken}` } : {});

/** Người nhận đồng ý gửi video phản ứng (file video đã quay). */
export const uploadReaction = (slug, blob) =>
  request(`/api/quay-phan-ung/${encodeURIComponent(slug)}`, { method: 'POST', headers: { 'Content-Type': blob.type || 'video/webm' }, body: blob });

/** Người tạo tải video phản ứng về (cần mã sửa). Trả Blob. */
export async function fetchReaction(slug, editToken) {
  const res = await fetch(`/api/quay-phan-ung/${encodeURIComponent(slug)}`, { headers: { Authorization: `Bearer ${editToken}` } }).catch(() => null);
  if (!res?.ok) throw new Error('Chưa tải được video, bạn thử lại nhé.');
  return res.blob();
}

/** Sổ tình yêu chung. */
export const listMemories = (slug) => request(`/api/so-tay/${encodeURIComponent(slug)}`);
export function addMemory(slug, { author, text, image }) {
  const form = new FormData();
  form.append('tac-gia', author);
  form.append('chu', text);
  if (image) form.append('anh', image, 'anh');
  return request(`/api/so-tay/${encodeURIComponent(slug)}`, { method: 'POST', body: form });
}
export const deleteMemory = (slug, editToken, id) =>
  request(`/api/so-tay/${encodeURIComponent(slug)}?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${editToken}` } });
