// Danh sách mẫu thiệp đã có giao diện. Mỗi mẫu gồm:
//   public/js/templates/<id>.js   có hàm render(stage, ctx)
//   public/css/templates/<id>.css bảng màu và hiệu ứng riêng
// Tải theo nhu cầu để trang thiệp chỉ tải đúng mẫu cần dùng.
const LOADERS = {
  'to-tinh': () => import('./to-tinh.js'),
  'phu-nu-2010': () => import('./phu-nu-2010.js'),
  'xin-loi': () => import('./xin-loi.js'),
  'di-choi': () => import('./di-choi.js'),
  'o-canh-em': () => import('./o-canh-em.js'),
  'ca-nhom': () => import('./ca-nhom.js'),
  'mo-khi': () => import('./mo-khi.js'),
  'sinh-nhat': () => import('./sinh-nhat.js'),
  'chuyen-tinh': () => import('./chuyen-tinh.js'),
  'so-tay': () => import('./so-tay.js'),
  // Thiệp hiệu ứng: cùng một khung (hieu-ung.js), khác hiệu ứng chạy bên trong.
  'vu-tru': () => effectCard('thien-ha', '🌌'),
  'tim-sang': () => effectCard('tim-hat', '💗'),
  'ten-sao': () => effectCard('ten-sao', '✨'),
  'tim-anh': () => effectCard('tim-anh', '🖼️'),
};

const effectCard = (effectId, emoji) => import('./hieu-ung.js').then((m) => m.forEffect(effectId, emoji));

/** Mẫu dùng chung file css với mẫu khác. */
const CSS_FILE = { 'vu-tru': 'hieu-ung', 'tim-sang': 'hieu-ung', 'ten-sao': 'hieu-ung', 'tim-anh': 'hieu-ung' };

/** Tải file css một lần: 'card' = css/card.css, còn lại là css của mẫu thiệp. */
export function loadCss(id) {
  const href = id === 'card' ? '/css/card.css' : `/css/templates/${CSS_FILE[id] || id}.css`;
  if (document.querySelector(`link[href="${href}"]`)) return Promise.resolve();
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = link.onerror = () => resolve();
    document.head.append(link);
  });
}

export async function loadTemplate(id) {
  const load = LOADERS[id];
  if (!load) throw new Error('Mẫu thiệp chưa có.');
  const [mod] = await Promise.all([load(), loadCss(id)]);
  return mod;
}
