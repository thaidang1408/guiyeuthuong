// Trang /thanh-toan/<mã đơn>#<slug>.<mã sửa>
// Hiện QR chuyển khoản, hỏi trạng thái đơn mỗi 3 giây, tiền về thì chuyển sang màn thành công.
import { comboPanel } from '../card/combo-panel.js';
import { invitePanel } from '../card/invite-panel.js';
import { TEMPLATES } from '../shared/templates.js';
import { sharePanel } from '../card/share-panel.js';
import { changePlan, getOrder, simulatePayment } from '../core/api.js';
import { copyText, el, qs, toast } from '../core/dom.js';
import { clearDraft } from '../core/draft-store.js';
import { rememberMyCard } from '../core/my-cards.js';
import { loadOrderInfo, manageLink, saveOrderInfo } from '../core/order-store.js';
import { manageSavePanel } from '../card/manage-save.js';
import { formatVnd, GUARANTEE, hasGuarantee, PLANS, UPGRADE, planName } from '../shared/plans.js';

const POLL_MS = 3000;
/** Hết hạn rồi vẫn hỏi thêm một lúc: khách chuyển muộn vẫn được kích hoạt. */
const POLL_AFTER_EXPIRY_MS = 30 * 60 * 1000;

const app = qs('#app');
const code = (location.pathname.split('/')[2] || '').toUpperCase();
const info = loadOrderInfo(code);
if (info?.slug) saveOrderInfo(code, info);

let order = null;
let pollTimer = null;
let countdownTimer = null;
let lastView = '';

// ---------- Hỏi trạng thái ----------

async function poll() {
  clearTimeout(pollTimer);
  try {
    order = await getOrder(code);
    render();
  } catch (e) {
    if (!order) return renderError(e.message);
  }
  const stopAt = (order?.expiresAt ?? 0) + POLL_AFTER_EXPIRY_MS;
  if (order?.status !== 'paid' && !document.hidden && Date.now() < stopAt) pollTimer = setTimeout(poll, POLL_MS);
}

// Tab ẩn thì ngừng hỏi (đỡ tốn lượt gọi server), hiện lại thì hỏi ngay.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearTimeout(pollTimer);
  else if (order?.status !== 'paid') poll();
});

// ---------- Hiển thị ----------

function render() {
  // Chỉ vẽ lại khi trạng thái/gói thay đổi, để ảnh QR không bị tải lại mỗi 3 giây.
  const view = `${order.status}|${order.plan}|${order.amount}`;
  if (view === lastView) return;
  lastView = view;
  clearInterval(countdownTimer);
  if (order.status === 'paid') renderPaid();
  else if (order.status === 'expired') renderExpired();
  else renderPending();
}

function page(title, children) {
  app.replaceChildren(
    el('header', { class: 'page-header' }, [el('a', { class: 'logo', text: '💌 Gửi Yêu Thương', attrs: { href: '/' } })]),
    el('main', { class: 'page-main' }, [el('h1', { text: title }), ...children]),
  );
}

function infoRow(label, value, copyable) {
  return el('div', { class: 'info-row' }, [
    el('span', { class: 'muted', text: label }),
    el('strong', { text: value }),
    copyable
      ? el('button', { class: 'btn btn-soft btn-sm', text: 'Sao chép', attrs: { type: 'button' }, on: { click: () => copyText(copyable) } })
      : el('span'),
  ]);
}

/** Thiệp nhóm: link mời cả nhóm ký tên (dùng được cả trước khi thanh toán). */
function groupInvite() {
  if (!info?.slug || !info?.editToken || !TEMPLATES[info.template]?.group) return null;
  return invitePanel({ slug: info.slug, editToken: info.editToken });
}

const isUpgrade = () => order.plan === UPGRADE.id;
/** Gói thiệp có sau khi trả (đơn nâng cấp → Đặc biệt). */
const effectivePlan = () => (isUpgrade() ? UPGRADE.to : order.plan);

/** Đổi gói trên đơn đang chờ (dùng cho cả ô chọn gói lẫn ô gợi ý). */
async function switchPlan(planId, btn) {
  btn.disabled = true;
  try {
    order = await changePlan(code, planId, info);
    render();
    toast(`Đã đổi sang gói ${PLANS[planId].name}`);
  } catch (err) {
    toast(err.message, 4000);
    btn.disabled = false;
  }
}

/**
 * Gợi ý nâng gói ngay trên trang thanh toán: Cơ bản → Đặc biệt (giọng nói, link 1 năm…),
 * Đặc biệt → Combo (thêm 2 thiệp cho mẹ, cô giáo… chỉ thêm ít tiền).
 */
function upsellPanel() {
  if (!info?.editToken || isUpgrade()) return null;
  const next = order.plan === 'co-ban' ? PLANS['dac-biet'] : order.plan === 'dac-biet' ? Object.values(PLANS).find((p) => p.cards) : null;
  if (!next) return null;
  const extra = next.price - order.amount;
  const [title, desc] = next.cards
    ? [`🎁 Thêm ${formatVnd(extra)} → được ${next.cards} thiệp`, `Gửi thêm cho mẹ, cô giáo, bạn thân… mỗi người một thiệp Đặc biệt riêng. Chỉ có mùa 20/10.`]
    : [`💎 Thêm ${formatVnd(extra)} → gói ${next.name}`, `Ghi âm giọng nói, xem video phản ứng, ${next.maxImages} ảnh, link giữ cả năm, sửa lời sau khi gửi.`];
  const btn = el('button', { class: 'btn btn-primary btn-sm', text: `Nâng lên ${formatVnd(next.price)}`, attrs: { type: 'button' } });
  btn.addEventListener('click', () => switchPlan(next.id, btn));
  return el('section', { class: 'panel upsell-panel' }, [el('strong', { text: title }), el('p', { class: 'small', text: desc }), btn]);
}

function planSwitcher() {
  if (!info?.editToken || isUpgrade()) return null;
  const group = el('div', { class: 'plan-switch', attrs: { role: 'radiogroup', 'aria-label': 'Chọn gói' } });
  for (const plan of Object.values(PLANS)) {
    const selected = plan.id === order.plan;
    group.append(
      el('button', {
        class: 'plan-chip' + (selected ? ' selected' : ''),
        attrs: { type: 'button', role: 'radio', 'aria-checked': String(selected) },
        on: {
          click: (e) => {
            if (!selected) switchPlan(plan.id, e.currentTarget);
          },
        },
      }, [
        el('span', { class: 'plan-chip-name', text: planName(plan.id) }),
        el('span', { class: 'plan-chip-price', text: formatVnd(plan.price) }),
        el('span', { class: 'plan-chip-desc', text: plan.cards ? `${plan.cards} thiệp Đặc biệt` : `${plan.maxImages} ảnh · ${plan.days} ngày` }),
      ]),
    );
  }
  return group;
}

/** Khung thử nghiệm: chỉ hiện khi chạy ở máy với DEV_SIMULATE_PAYMENT=1. */
function devPanel() {
  if (!order.devSimulate) return null;
  const button = (label, mode, cls) =>
    el('button', {
      class: `btn ${cls} btn-sm`,
      text: label,
      attrs: { type: 'button' },
      on: {
        click: async (e) => {
          const btn = e.currentTarget; // sau "await", e.currentTarget không còn trỏ tới nút
          btn.disabled = true;
          try {
            const res = await simulatePayment(code, mode);
            const meaning = { matched: 'khớp đơn ✓', needs_review: 'chưa khớp, cần duyệt tay', duplicate: 'trùng, bỏ qua' };
            toast(`Đã giả lập chuyển ${formatVnd(res.amount)} → ${meaning[res.outcome] || res.outcome}`, 4000);
            poll();
          } catch (err) {
            toast(err.message, 4000);
          } finally {
            btn.disabled = false;
          }
        },
      },
    });
  return el('section', { class: 'panel dev-panel' }, [
    el('p', { class: 'small' }, [el('strong', { text: '🧪 Chế độ thử' }), el('span', { text: ' — chỉ hiện trên máy bạn, khách không bao giờ thấy.' })]),
    el('div', { class: 'share-actions' }, [
      button('✅ Giả lập tiền về đủ', 'du', 'btn-primary'),
      button('⚠️ Giả lập chuyển thiếu', 'thieu', 'btn-ghost'),
    ]),
  ]);
}

function renderPending() {
  const p = order.payment;
  if (!p) {
    page('Chưa nhận thanh toán được', [
      el('p', { text: 'Hệ thống chưa cấu hình tài khoản nhận tiền. Bạn liên hệ hỗ trợ giúp mình nhé.' }),
      el('a', { class: 'btn btn-primary', text: 'Liên hệ hỗ trợ', attrs: { href: '/ho-tro' } }),
    ]);
    return;
  }
  const countdown = el('span', { class: 'countdown' });
  const tick = () => {
    const left = Math.max(0, order.expiresAt - Date.now());
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    countdown.textContent = `${m}:${String(s).padStart(2, '0')}`;
  };
  tick();
  countdownTimer = setInterval(tick, 1000);

  page(isUpgrade() ? `${UPGRADE.name}: quét mã để thanh toán` : 'Quét mã để thanh toán', [
    groupInvite(),
    upsellPanel(),
    planSwitcher(),
    el('section', { class: 'panel qr-panel' }, [
      el('img', {
        class: 'pay-qr',
        attrs: { src: p.qrUrl, alt: `Mã QR chuyển ${formatVnd(order.amount)} với nội dung ${p.content}`, width: '300', height: '300' },
      }),
      el('p', { class: 'muted small center', text: 'Mở app ngân hàng → Quét QR. Số tiền và nội dung đã được điền sẵn.' }),
    ]),
    el('section', { class: 'panel' }, [
      el('p', { class: 'small', text: 'Không quét được? Chuyển khoản tay theo thông tin này:' }),
      infoRow('Số tiền', formatVnd(order.amount), String(order.amount)),
      infoRow('Ngân hàng', p.bank),
      infoRow('Số tài khoản', p.acc, p.acc),
      infoRow('Nội dung', p.content, p.content),
      el('p', { class: 'warn small', text: `⚠️ Nhớ ghi đúng nội dung "${p.content}" để thiệp được kích hoạt tự động.` }),
    ]),
    el('div', { class: 'waiting', attrs: { 'aria-live': 'polite' } }, [
      el('span', { class: 'spinner', attrs: { 'aria-hidden': 'true' } }),
      el('span', { text: 'Đang chờ tiền về… Trang sẽ tự chuyển khi nhận được.' }),
    ]),
    el('p', { class: 'muted small center' }, [el('span', { text: 'Mã đơn hết hạn sau ' }), countdown]),
    hasGuarantee(order.plan)
      ? el('p', { class: 'guarantee small center', text: `🛡️ Không ưng ý? Nhắn hỗ trợ trong ${GUARANTEE.hours} giờ sau khi thanh toán để được hoàn 100% tiền.` })
      : null,
    devPanel(),
  ]);
}

function renderPaid() {
  if (info?.template) clearDraft(info.template);
  if (!info?.slug || !info?.editToken) {
    page('Thanh toán thành công 🎉', [
      el('p', { text: `Đơn ${code} đã được thanh toán.` }),
      el('p', { text: 'Trình duyệt này không lưu link thiệp. Bạn mở lại trang thanh toán trên trình duyệt đã tạo thiệp, hoặc nhắn hỗ trợ kèm mã đơn nhé.' }),
      el('a', { class: 'btn btn-primary', text: 'Liên hệ hỗ trợ', attrs: { href: '/ho-tro' } }),
    ]);
    return;
  }
  const manage = manageLink(info.slug, info.editToken);
  rememberMyCard({ slug: info.slug, editToken: info.editToken, recipientName: info.recipientName, template: info.template, plan: effectivePlan() });
  if (isUpgrade()) {
    page('Đã nâng cấp lên gói Đặc biệt 🎉', [
      el('p', { class: 'lead', text: 'Link thiệp giữ nguyên, nay dùng được thêm 365 ngày. Bạn sửa lời nhắn được trong trang quản lý.' }),
      el('a', { class: 'btn btn-primary', text: '⚙️ Về trang quản lý thiệp', attrs: { href: manage } }),
    ]);
    return;
  }
  page('Thiệp đã sẵn sàng 🎉', [
    el('p', { class: 'lead', text: 'Gửi link dưới đây cho người ấy qua Zalo, Messenger… là xong!' }),
    sharePanel({ slug: info.slug, plan: order.plan, recipientName: info.recipientName }),
    order.plan === 'combo' ? comboPanel(info.editToken) : null,
    groupInvite(),
    manageSavePanel({ slug: info.slug, manage, recipientName: info.recipientName || 'người ấy', canEdit: !!PLANS[order.plan]?.canEditAfterSend }),
  ]);
}

function renderExpired() {
  page('Đơn đã hết hạn', [
    el('p', { text: `Đơn ${code} đã quá 30 phút mà chưa nhận được tiền.` }),
    el('p', { class: 'small muted', text: 'Nếu bạn đã chuyển khoản, cứ để trang này mở thêm vài phút — tiền về là thiệp tự kích hoạt. Quá lâu chưa thấy thì nhắn hỗ trợ kèm mã đơn nhé.' }),
    el('div', { class: 'share-actions' }, [
      info?.template ? el('a', { class: 'btn btn-primary', text: 'Tạo lại đơn mới', attrs: { href: `/tao?mau=${encodeURIComponent(info.template)}` } }) : null,
      el('a', { class: 'btn btn-ghost', text: 'Liên hệ hỗ trợ', attrs: { href: '/ho-tro' } }),
    ]),
    devPanel(),
  ]);
}

function renderError(message) {
  page('Không mở được đơn', [el('p', { text: message }), el('a', { class: 'btn btn-primary', text: 'Về trang chủ', attrs: { href: '/' } })]);
}

if (!/^TX[A-Z2-9]{4}$/.test(code)) renderError('Mã đơn không hợp lệ.');
else poll();
