// Trang chủ: vẽ danh sách mẫu thiệp (kèm "điện thoại mini" tự chạy) và bảng giá từ file cấu hình dùng chung.
import { getStats } from '../core/api.js';
import { listMyCards } from '../core/my-cards.js';
import { el, qs } from '../core/dom.js';
import { GUARANTEE, PLANS, PROMO, activeListPrice, formatVnd, hasGuarantee } from '../shared/plans.js';
import { TEMPLATES } from '../shared/templates.js';

/** Thứ tự hiển thị trong "Tất cả". */
const ORDER = ['chuyen-tinh', 'so-tay', 'vu-tru', 'phu-nu-2010', 'tim-sang', 'to-tinh', 'ten-sao', 'ca-nhom', 'tim-anh', 'sinh-nhat', 'o-canh-em', 'xin-loi', 'mo-khi', 'di-choi'];

/** Nhóm để lọc nhanh; nhóm đầu tiên được chọn sẵn. Thêm mẫu mới: thêm id vào nhóm phù hợp. */
const CATEGORIES = [
  { id: 'hot', name: '🔥 Hot', ids: ['chuyen-tinh', 'vu-tru', 'tim-sang', 'phu-nu-2010', 'to-tinh', 'ten-sao', 'tim-anh'] },
  { id: '20-10', name: '🌷 20/10', ids: ['phu-nu-2010', 'ca-nhom', 'tim-anh', 'ten-sao'] },
  { id: 'tinh-yeu', name: '💕 Tình yêu', ids: ['chuyen-tinh', 'so-tay', 'vu-tru', 'tim-sang', 'to-tinh', 'o-canh-em', 'xin-loi', 'di-choi', 'mo-khi', 'tim-anh'] },
  { id: 'gia-dinh', name: '🎂 Gia đình & bạn bè', ids: ['sinh-nhat', 'ca-nhom', 'ten-sao', 'tim-anh', 'mo-khi', 'di-choi'] },
  { id: 'tat-ca', name: 'Tất cả', ids: ORDER },
];

/** Nhãn nhỏ góc trên thẻ mẫu. */
const BADGES = { 'chuyen-tinh': '💑 Cho cặp đôi', 'so-tay': '🆕 Viết cùng nhau', 'vu-tru': '🔥 Hot', 'tim-sang': '🔥 Hot', 'phu-nu-2010': '🌷 20/10', 'ca-nhom': '👥 Cả lớp ký', 'ten-sao': '✨ Mới', 'tim-anh': '✨ Mới' };

/** Chỉ hiện số thiệp đã gửi khi đã đủ nhiều (số thật, không bịa). */
const STATS_MIN = 50;

/** Màn hình mini mô phỏng khoảnh khắc "wow" của từng mẫu (chỉ CSS, không tốn tài nguyên). */
const MINI_DEMOS = {
  'phu-nu-2010': () => [
    el('div', { class: 'mini-petals', attrs: { 'aria-hidden': 'true' } }, Array.from({ length: 7 }, () => el('i'))),
    el('div', { class: 'mini-envelope' }, [el('span', { class: 'mini-flap' }), el('span', { class: 'mini-seal', text: '🌷' })]),
    el('p', { class: 'mini-caption hand', text: 'Gửi mẹ yêu của con' }),
  ],
  'to-tinh': () => [
    el('p', { class: 'mini-question', text: 'Làm người yêu tớ nhé?' }),
    el('div', { class: 'mini-buttons' }, [el('span', { class: 'mini-yes', text: 'Có 💖' }), el('span', { class: 'mini-no runaway', text: 'Không' })]),
  ],
  'xin-loi': () => [
    el('p', { class: 'mini-question', text: 'Tha lỗi cho tớ nhé? 🥺' }),
    el('div', { class: 'mini-buttons' }, [el('span', { class: 'mini-yes grow', text: 'Tha 🥰' }), el('span', { class: 'mini-no shrink', text: 'Không tha' })]),
  ],
  'o-canh-em': () => [
    el('div', { class: 'mini-hug' }, [el('span', { class: 'mini-hug-l', text: '💗' }), el('span', { class: 'mini-hug-r', text: '💗' })]),
    el('p', { class: 'mini-caption hand', text: 'Mình đã bên nhau 1.000 ngày' }),
  ],
  'ca-nhom': () => [
    el('div', { class: 'mini-notes' }, [
      el('span', { class: 'mini-note', text: '🌷 Chúc cô vui!' }),
      el('span', { class: 'mini-note', text: '💖 Thương cô' }),
      el('span', { class: 'mini-note', text: '🎉 20/10 ạ' }),
    ]),
    el('p', { class: 'mini-caption', text: '32 người đã ký tên 💐' }),
  ],
  'sinh-nhat': () => [
    el('div', { class: 'mini-cake' }, [
      el('div', { class: 'mini-candles' }, Array.from({ length: 3 }, () => el('i'))),
      el('span', { class: 'mini-cake-body' }),
    ]),
    el('p', { class: 'mini-caption hand', text: 'Thổi nến đi nào! 🕯️' }),
  ],
  'mo-khi': () => [
    el('div', { class: 'mini-envs' }, [
      el('span', { text: '💌 Mở khi buồn' }),
      el('span', { text: '💌 Mở khi nhớ' }),
      el('span', { class: 'locked', text: '🔒 14/02' }),
      el('span', { text: '💌 Mở khi giận' }),
    ]),
  ],
  'chuyen-tinh': () => [
    el('div', { class: 'mini-story' }, [
      el('div', { class: 'mini-story-bars' }, [el('i', { class: 'done' }), el('i', { class: 'active' }), el('i')]),
      el('span', { class: 'mini-story-num', text: '1.000' }),
      el('span', { class: 'mini-story-cap hand', text: 'ngày bên nhau 💕' }),
    ]),
  ],
  'so-tay': () => [
    el('div', { class: 'mini-book' }, [
      el('span', { class: 'mini-book-page', text: 'Hôm nay đi Đà Lạt 🌲' }),
      el('span', { class: 'mini-book-page right', text: 'Nhớ cậu ghê 💕' }),
    ]),
    el('p', { class: 'mini-caption hand', text: 'Cả hai cùng viết' }),
  ],
  'di-choi': () => [
    el('p', { class: 'mini-question', text: 'Đi chơi với tớ không? 🍜' }),
    el('div', { class: 'mini-ticket' }, [
      el('span', { class: 'mini-ticket-row', text: '📅 T7 · 🍲 Lẩu' }),
      el('span', { class: 'mini-stamp', text: 'ĐÃ CHỐT KÈO' }),
    ]),
  ],
};

/** Thiệp hiệu ứng: ô tối có hiệu ứng mini chạy bằng CSS. */
const fxMini = (t) =>
  el('div', { class: `mini-phone mini-fx fx-card-${t.effect}`, attrs: { 'aria-hidden': 'true' } }, [
    el('div', { class: 'fx-mini' }, [el('span', { class: 'fx-mini-art', text: t.emoji }), el('i'), el('i'), el('i')]),
  ]);

/** Cả thẻ là một nút: chạm vào là xem thử (trong trang xem thử có nút "Dùng mẫu này"). */
function templateCard(t) {
  const demo = t.effect ? fxMini(t) : el('div', { class: `mini-phone mini-${t.id}`, attrs: { 'aria-hidden': 'true' } }, MINI_DEMOS[t.id]?.() || []);
  return el('a', { class: 'template-card', attrs: { href: `/xem-truoc?demo=${t.id}` } }, [
    BADGES[t.id] ? el('span', { class: 'template-badge', text: BADGES[t.id] }) : null,
    demo,
    el('div', { class: 'template-body' }, [
      el('h3', {}, [el('span', { text: `${t.emoji} ` }), el('span', { text: t.name })]),
      el('p', { class: 'muted small template-tagline', text: t.tagline }),
      el('span', { class: 'template-cta', text: '▶ Xem thử' }),
    ]),
  ]);
}

const chipBox = qs('#cat-chips');
function showCategory(cat) {
  for (const c of chipBox.children) c.classList.toggle('selected', c.dataset.cat === cat.id);
  qs('#template-list').replaceChildren(...cat.ids.filter((id) => TEMPLATES[id]?.ready).map((id) => templateCard(TEMPLATES[id])));
}
chipBox.replaceChildren(
  ...CATEGORIES.map((c) =>
    el('button', { class: 'chip', text: c.name, attrs: { type: 'button', 'data-cat': c.id }, on: { click: () => showCategory(c) } }),
  ),
);
showCategory(CATEGORIES[0]);

// Chỉ chạy hiệu ứng của thiệp mini đang nằm trên màn hình: 20 thiệp mini cùng chạy làm cuộn trang khựng trên điện thoại.
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) e.target.classList.toggle('mini-off', !e.isIntersecting);
  }, { rootMargin: '120px 0px' });
  const watch = () => document.querySelectorAll('.mini-phone, .free-art').forEach((n) => io.observe(n));
  watch();
  new MutationObserver(watch).observe(qs('#template-list'), { childList: true });
}

// Đến từ nút "Gửi lại một tấm cho …" ở cuối thiệp: nhắc chọn mẫu, tên sẽ được điền sẵn.
try {
  const reply = JSON.parse(sessionStorage.getItem('gui-lai') || 'null');
  if (reply?.to) {
    qs('#mau-thiep h2').after(el('p', { class: 'reply-banner', text: `💌 Gửi lại cho ${reply.to}: chọn một mẫu bên dưới, tên hai bạn đã được điền sẵn.` }));
  }
} catch {
  /* bỏ qua */
}

// Bảng giá: 3 gói để chọn (xem thử miễn phí nằm ở dòng cam kết), mỗi gói có nút bấm,
// tính năng so bằng ✓ / ✗ để thấy ngay gói Đặc biệt hơn gì. Giá, số ảnh, số ngày lấy từ shared/plans.js.
const basic = PLANS['co-ban'];
const special = PLANS['dac-biet'];
const feat = (text, on = true) => el('li', { class: on ? 'yes' : 'no', text });
const priceTag = (p) =>
  el('p', { class: 'price' }, [
    activeListPrice(p) ? el('s', { class: 'list-price', text: formatVnd(activeListPrice(p)) }) : '',
    el('span', { text: formatVnd(p.price) }),
  ]);
const promoNote = (p) => (activeListPrice(p) ? el('p', { class: 'promo-note', text: `${PROMO.label} đến hết ${PROMO.until.split('-').reverse().join('/')}` }) : '');
const guarantee = (p) => (hasGuarantee(p.id) ? el('p', { class: 'guarantee-line', text: `🛡️ Không ưng? Hoàn tiền trong ${GUARANTEE.hours} giờ` }) : '');
const cta = (text, primary) => el('a', { class: `btn ${primary ? 'btn-primary' : 'btn-soft'} price-cta`, text, attrs: { href: '#mau-thiep' } });

qs('#price-list').replaceChildren(
  el('article', { class: 'price-card' }, [
    el('h3', { text: basic.name }),
    el('p', { class: 'price-sub', text: 'Gửi nhanh, gọn, vẫn đủ hiệu ứng' }),
    priceTag(basic),
    promoNote(basic),
    el('p', { class: 'price-hint', text: '≈ một ly trà sữa 🧋' }),
    el('ul', { class: 'feat-list' }, [
      feat('Tất cả mẫu thiệp, hiệu ứng, trò chơi'),
      feat(`${basic.maxImages} ảnh · link dùng ${basic.days} ngày`),
      feat('Hẹn giờ mở thiệp'),
      feat('Lời nhắn giọng nói', false),
      feat('Quay phản ứng người nhận', false),
      feat('Mở cùng nhau · nhạc của bạn', false),
      feat('Sửa lời sau khi gửi · QR in kèm quà', false),
    ]),
    cta('Chọn mẫu thiệp', false),
    guarantee(basic),
  ]),
  el('article', { class: 'price-card featured' }, [
    el('span', { class: 'badge', text: '⭐ Đáng tiền nhất' }),
    el('h3', { text: special.name }),
    el('p', { class: 'price-sub', text: 'Đầy đủ nhất, đáng nhớ nhất' }),
    priceTag(special),
    promoNote(special),
    el('p', { class: 'price-hint', text: `Chỉ thêm ${formatVnd(special.price - basic.price)} so với gói ${basic.name}` }),
    el('ul', { class: 'feat-list' }, [
      feat(`Mọi thứ của gói ${basic.name}`),
      feat(`${special.maxImages} ảnh · link dùng cả năm`),
      feat('🎙️ Lời nhắn giọng nói'),
      feat('📹 Quay phản ứng người nhận'),
      feat('💞 Mở cùng nhau · 🎵 nhạc của bạn'),
      feat('Sửa lời sau khi gửi · QR in kèm quà'),
    ]),
    cta('💌 Tạo thiệp ngay', true),
    guarantee(special),
  ]),
  ...Object.values(PLANS)
    .filter((p) => p.cards)
    .map((p) =>
      el('article', { class: 'price-card combo' }, [
        el('span', { class: 'badge', text: '🎁 Chỉ có mùa 20/10' }),
        el('h3', { text: p.name }),
        el('p', { class: 'price-sub', text: `${p.cards} thiệp ${special.name}, mỗi người một tấm` }),
        priceTag(p),
        promoNote(p),
        el('p', { class: 'price-hint', text: `≈ ${formatVnd(Math.round(p.price / p.cards / 1000) * 1000)}/thiệp · tiết kiệm ${formatVnd(p.cards * special.price - p.price)}` }),
        el('ul', { class: 'feat-list' }, [
          feat(`${p.cards} thiệp, mỗi thiệp đủ quyền gói ${special.name}`),
          feat('Gửi mẹ, cô giáo, người yêu… mỗi người một thiệp riêng'),
          feat('Trả một lần, thiệp sau chỉ cần nhập mã'),
        ]),
        cta('Chọn mẫu thiệp', false),
      ]),
    ),
);

getStats()
  .then(({ cardsSent }) => {
    if (cardsSent < STATS_MIN) return;
    const line = qs('#stats-line');
    line.textContent = `💌 Đã có ${cardsSent.toLocaleString('vi-VN')} tấm thiệp được gửi đi`;
    line.hidden = false;
  })
  .catch(() => {});

// Đã từng tạo thiệp trên máy này thì hiện lối tắt "Thiệp của tôi" ở đầu trang.
if (listMyCards().length) qs('#my-cards-link').hidden = false;
