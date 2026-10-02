// Trang /admin: đăng nhập bằng mật khẩu (cookie HttpOnly do server đặt), xem doanh thu,
// xử lý giao dịch cần xem, báo cáo, gỡ thiệp. Mọi chữ hiển thị đều qua textContent.
import { el, qs, toast } from '../core/dom.js';
import { formatVnd, planName } from '../shared/plans.js';
import { TEMPLATES } from '../shared/templates.js';

const app = qs('#app');
const ORDER_TTL_MS = 30 * 60 * 1000;
const timeFmt = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' });
const fmtTime = (ms) => (ms ? timeFmt.format(new Date(ms)) : '—');

async function api(path, body) {
  let res;
  try {
    res = await fetch(`/api/admin/${path}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  } catch {
    throw new Error('Mạng đang chập chờn, thử lại nhé.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== 'dang-nhap') {
    showLogin(data.error);
    throw new Error(data.error || 'Cần đăng nhập.');
  }
  if (!res.ok) throw new Error(data.error || 'Có lỗi xảy ra.');
  return data;
}

/** Nút gọi một thao tác; hỏi xác nhận trước nếu cần, xong thì tải lại bảng điều khiển. */
function actionButton(label, cls, body, { confirmText, done } = {}) {
  const btn = el('button', { class: `btn btn-sm ${cls}`, text: label, attrs: { type: 'button' } });
  btn.addEventListener('click', async () => {
    const payload = typeof body === 'function' ? body() : body;
    if (!payload) return;
    if (confirmText && !confirm(confirmText)) return;
    btn.disabled = true;
    try {
      await api('thao-tac', payload);
      toast(done || 'Đã xong ✓');
      await loadDashboard();
    } catch (e) {
      toast(e.message, 4000);
      btn.disabled = false;
    }
  });
  return btn;
}

// ---------- Đăng nhập ----------

function showLogin(message) {
  const input = el('input', { class: 'input', attrs: { type: 'password', autocomplete: 'current-password', placeholder: 'Mật khẩu quản trị', required: '' } });
  const submit = el('button', { class: 'btn btn-primary', text: 'Đăng nhập', attrs: { type: 'submit' } });
  const form = el('form', {}, [input, submit]);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submit.disabled = true;
    try {
      await api('dang-nhap', { password: input.value });
      await loadDashboard();
    } catch (err) {
      toast(err.message, 4000);
      submit.disabled = false;
      input.select();
    }
  });
  app.replaceChildren(
    el('main', { class: 'page-main admin-login' }, [
      el('h1', { text: '🔐 Quản trị' }),
      message ? el('p', { class: 'muted small', text: message }) : null,
      form,
    ]),
  );
  input.focus();
}

// ---------- Các khối hiển thị ----------

function orderBadge(o) {
  if (o.status === 'paid') return el('span', { class: 'badge badge-ok', text: 'Đã trả' });
  if (o.status === 'pending' && Date.now() - o.createdAt < ORDER_TTL_MS) return el('span', { class: 'badge badge-wait', text: 'Chờ trả' });
  return el('span', { class: 'badge badge-off', text: 'Hết hạn' });
}

const CARD_STATUS = { draft: 'Nháp', active: 'Đang chạy', expired: 'Hết hạn', removed: 'Đã gỡ' };
function cardBadge(status) {
  const cls = status === 'active' ? 'badge-ok' : status === 'removed' ? 'badge-bad' : 'badge-off';
  return el('span', { class: `badge ${cls}`, text: `Thiệp: ${CARD_STATUS[status] || status}` });
}

function orderItem(o) {
  const actions = [];
  if (o.status !== 'paid') {
    actions.push(
      actionButton('Kích hoạt thủ công', 'btn-soft', { action: 'kich-hoat', code: o.code }, {
        confirmText: `Kích hoạt đơn ${o.code} (${formatVnd(o.amount)}) dù chưa nhận tiền tự động?`,
        done: 'Đã kích hoạt thiệp',
      }),
    );
  }
  if (o.cardStatus === 'active') {
    actions.push(el('a', { class: 'btn btn-sm btn-ghost', text: 'Mở thiệp', attrs: { href: `/t/${o.slug}`, target: '_blank', rel: 'noopener' } }));
  }
  if (o.cardStatus !== 'removed') {
    actions.push(removeButton(o.slug));
  }
  return el('div', { class: 'admin-item' }, [
    el('div', { class: 'admin-item-head' }, [el('strong', { text: o.code }), orderBadge(o), cardBadge(o.cardStatus)]),
    el('div', {
      class: 'meta',
      text: `${planName(o.plan)} · ${o.amount === 0 ? '0đ (dùng mã combo)' : formatVnd(o.amount)} · ${TEMPLATES[o.template]?.name || o.template} · gửi ${o.recipientName || '?'}`,
    }),
    el('div', {
      class: 'meta',
      text: `Tạo ${fmtTime(o.createdAt)}${o.paidAt ? ` · trả ${fmtTime(o.paidAt)}` : ''}${o.expiresAt ? ` · hết hạn ${fmtTime(o.expiresAt)}` : ''} · ${o.views} lượt mở · mã thiệp ${o.slug}`,
    }),
    actions.length ? el('div', { class: 'admin-actions' }, actions) : null,
  ]);
}

const removeButton = (slug) =>
  actionButton('Gỡ thiệp', 'btn-ghost', { action: 'go-thiep', slug }, {
    confirmText: `Gỡ thiệp ${slug}? Link sẽ không mở được nữa, ảnh và nhạc bị xóa vĩnh viễn.`,
    done: 'Đã gỡ thiệp',
  });

function paymentItem(p) {
  const codeInput = el('input', { class: 'input', attrs: { placeholder: 'Mã đơn TX…', maxlength: '6', autocapitalize: 'characters' } });
  codeInput.value = p.orderCode || '';
  let note = 'Nội dung chuyển khoản không có mã đơn. Tiền của khách thì hỏi mã đơn rồi nhập vào; tiền khác (không liên quan app) thì bấm "Bỏ qua".';
  if (p.orderCode && p.orderAmount !== null) {
    note =
      p.orderStatus === 'paid'
        ? `Đơn ${p.orderCode} đã được kích hoạt trước đó (có thể khách chuyển 2 lần).`
        : `Đơn ${p.orderCode} cần ${formatVnd(p.orderAmount)}, khách chuyển ${formatVnd(p.amount)}${p.amount < p.orderAmount ? ` (thiếu ${formatVnd(p.orderAmount - p.amount)})` : ''}.`;
  } else if (p.orderCode) {
    note = `Không có đơn ${p.orderCode} trong hệ thống (thiệp nháp đã bị dọn sau 24 giờ, hoặc là giao dịch cũ). Nếu không liên quan thì bấm "Bỏ qua".`;
  }
  return el('div', { class: 'admin-item' }, [
    el('div', { class: 'admin-item-head' }, [el('strong', { text: formatVnd(p.amount) }), el('span', { class: 'meta', text: fmtTime(p.createdAt) })]),
    el('div', { class: 'quote', text: p.content || '(không có nội dung)' }),
    el('div', { class: 'meta', text: note }),
    el('div', { class: 'admin-actions' }, [
      codeInput,
      actionButton('Kích hoạt thủ công', 'btn-primary', () => {
        const code = codeInput.value.trim().toUpperCase();
        if (!code) {
          toast('Nhập mã đơn trước nhé.');
          return null;
        }
        return { action: 'kich-hoat', code, paymentId: p.id };
      }, { confirmText: 'Kích hoạt thiệp cho đơn này?', done: 'Đã kích hoạt thiệp' }),
      actionButton('Bỏ qua', 'btn-ghost', { action: 'bo-qua-giao-dich', paymentId: p.id }, {
        confirmText: 'Ẩn giao dịch này khỏi danh sách (không kích hoạt gì)?',
      }),
    ]),
  ]);
}

function reportItem(r) {
  return el('div', { class: 'admin-item' }, [
    el('div', { class: 'admin-item-head' }, [el('strong', { text: `Thiệp ${r.slug}` }), cardBadge(r.cardStatus), el('span', { class: 'meta', text: fmtTime(r.createdAt) })]),
    el('div', { class: 'quote', text: r.reason }),
    el('div', { class: 'admin-actions' }, [
      r.cardStatus === 'active' ? el('a', { class: 'btn btn-sm btn-soft', text: 'Xem thiệp', attrs: { href: `/t/${r.slug}`, target: '_blank', rel: 'noopener' } }) : null,
      r.cardStatus !== 'removed' ? removeButton(r.slug) : null,
      actionButton('Không vi phạm', 'btn-ghost', { action: 'bo-qua-bao-cao', reportId: r.id }),
    ]),
  ]);
}

function section(title, items, render, emptyText) {
  return el('section', { class: 'panel' }, [
    el('h2', {}, [el('span', { text: title }), items.length ? el('span', { class: 'admin-count', text: String(items.length) }) : null]),
    items.length ? el('div', { class: 'admin-list' }, items.map(render)) : el('p', { class: 'admin-empty', text: emptyText }),
  ]);
}

function searchBox() {
  const input = el('input', { class: 'input', attrs: { placeholder: 'Mã đơn (TXAB23) hoặc mã thiệp', autocapitalize: 'off' } });
  const results = el('div', { class: 'admin-list' });
  const form = el('form', { class: 'admin-search' }, [input, el('button', { class: 'btn btn-primary btn-sm', text: 'Tìm', attrs: { type: 'submit' } })]);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const { orders } = await api(`tim?q=${encodeURIComponent(input.value.trim())}`);
      results.replaceChildren(...(orders.length ? orders.map(orderItem) : [el('p', { class: 'admin-empty', text: 'Không tìm thấy.' })]));
    } catch (err) {
      toast(err.message, 4000);
    }
  });
  return el('section', { class: 'panel' }, [
    el('h2', { text: '🔎 Tìm đơn' }),
    el('p', { class: 'muted small', text: 'Khách nhắn Zalo kèm mã đơn thì tìm ở đây.' }),
    form,
    results,
  ]);
}

function stat(label, r) {
  return el('div', { class: 'stat' }, [el('span', { text: label }), el('strong', { text: formatVnd(r.total) }), el('span', { text: `${r.orders} đơn` })]);
}

/** Đã dùng bao nhiêu lượt giao dịch SePay tháng này (gói miễn phí có giới hạn). */
function sepayMeter({ used, limit }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const level = used >= limit ? 'full' : used >= limit * 0.8 ? 'warn' : 'ok';
  const bar = el('div', { class: 'meter-bar' }, [el('span')]);
  bar.firstChild.style.width = `${pct}%`;
  const advice = {
    ok: 'Còn thoải mái.',
    warn: '⚠️ Sắp chạm giới hạn! Vào my.sepay.vn nâng gói (trả bằng tiền bán được) để đơn mới vẫn tự kích hoạt.',
    full: '🚨 Đã hết lượt miễn phí: đơn mới có thể KHÔNG tự kích hoạt. Nâng gói SePay ngay, hoặc kích hoạt tay ở mục "Giao dịch cần xem".',
  }[level];
  return el('section', { class: `panel sepay-meter ${level}` }, [
    el('p', {}, [el('strong', { text: '🏦 Giao dịch SePay tháng này: ' }), el('span', { text: `${used}/${limit}` })]),
    bar,
    el('p', { class: 'small', text: advice }),
  ]);
}

// ---------- Bảng điều khiển ----------

async function loadDashboard() {
  const d = await api('tong-quan');
  const logout = el('button', {
    class: 'btn btn-ghost btn-sm',
    text: 'Đăng xuất',
    attrs: { type: 'button' },
    on: {
      click: async () => {
        await api('dang-xuat', {}).catch(() => {});
        showLogin('Đã đăng xuất.');
      },
    },
  });
  const reload = el('button', {
    class: 'btn btn-soft btn-sm',
    text: '↻ Tải lại',
    attrs: { type: 'button' },
    on: { click: () => loadDashboard().then(() => toast('Đã cập nhật')).catch((e) => toast(e.message)) },
  });

  app.replaceChildren(
    el('main', { class: 'page-main admin-main' }, [
      el('header', { class: 'admin-top' }, [el('h1', { text: '📊 Quản trị' }), el('div', { class: 'admin-actions' }, [reload, logout])]),
      el('div', { class: 'stats' }, [stat('Hôm nay', d.revenue.today), stat('7 ngày', d.revenue.week), stat('30 ngày', d.revenue.month)]),
      sepayMeter(d.sepay),
      section('⚠️ Giao dịch cần xem', d.payments, paymentItem, 'Không có giao dịch nào cần xử lý 🎉'),
      section('🚩 Báo cáo thiệp', d.reports, reportItem, 'Chưa có báo cáo nào.'),
      searchBox(),
      section('🧾 Đơn mới nhất', d.orders, orderItem, 'Chưa có đơn nào.'),
    ]),
  );
}

loadDashboard().catch(() => {});
