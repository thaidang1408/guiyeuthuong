// Trang /quan-ly/<slug>#<mã sửa> — người tạo xem lượt mở, lấy link/QR, sửa lời nhắn (gói Đặc biệt).
import { comboPanel } from '../card/combo-panel.js';
import { invitePanel } from '../card/invite-panel.js';
import { sharePanel } from '../card/share-panel.js';
import { createUpgrade, deleteMemory, deleteSignature, fetchReaction, getManage, updateManage } from '../core/api.js';
import { formatOpenAt } from '../shared/schedule.js';
import { copyText, el, qs, toast } from '../core/dom.js';
import { textField } from '../core/form.js';
import { rememberMyCard } from '../core/my-cards.js';
import { encodeOrderHash, manageLink, saveOrderInfo } from '../core/order-store.js';
import { GUARANTEE, PLANS, UPGRADE, formatVnd, upgradePrice, withinGuarantee } from '../shared/plans.js';
import { quizVerdict } from '../shared/games.js';
import { COMMON_FIELDS, TEMPLATES } from '../shared/templates.js';

const app = qs('#app');
const slug = location.pathname.split('/')[2] || '';
const token = decodeURIComponent(location.hash.slice(1));

const STATUS = {
  draft: ['Chờ thanh toán', 'badge-wait'],
  active: ['Đang hoạt động', 'badge-ok'],
  expired: ['Đã hết hạn', 'badge-off'],
  removed: ['Đã bị gỡ', 'badge-off'],
};

const formatDate = (ms) => new Date(ms).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

function page(children) {
  app.replaceChildren(
    el('header', { class: 'page-header' }, [el('a', { class: 'logo', text: '💌 Gửi Yêu Thương', attrs: { href: '/' } })]),
    el('main', { class: 'page-main' }, children),
  );
}

function stat(label, value) {
  return el('div', { class: 'stat' }, [el('strong', { text: value }), el('span', { class: 'muted small', text: label })]);
}

function editForm(card) {
  const tpl = TEMPLATES[card.template];
  const draft = { recipientName: card.data.recipientName, senderName: card.data.senderName, texts: { ...card.data.texts } };
  const fields = [
    textField(COMMON_FIELDS.recipientName, draft.recipientName, (v) => (draft.recipientName = v)).wrap,
    textField(COMMON_FIELDS.senderName, draft.senderName, (v) => (draft.senderName = v)).wrap,
    ...Object.entries(tpl?.texts || {}).map(([key, def]) => textField(def, draft.texts[key], (v) => (draft.texts[key] = v)).wrap),
  ];
  const save = el('button', {
    class: 'btn btn-primary',
    text: 'Lưu thay đổi',
    attrs: { type: 'submit' },
  });
  const form = el('form', { class: 'panel' }, [
    el('h2', { text: '✏️ Sửa lời nhắn' }),
    el('p', { class: 'muted small', text: 'Lưu xong, người nhận mở lại link là thấy nội dung mới. Ảnh và nhạc giữ nguyên.' }),
    ...fields,
    save,
  ]);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    save.disabled = true;
    try {
      await updateManage(slug, token, draft);
      toast('Đã lưu ✓');
    } catch (err) {
      toast(err.message, 4000);
    } finally {
      save.disabled = false;
    }
  });
  return form;
}

const answerDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  const s = new Date(y, m - 1, d).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const when = (ms) => new Date(ms).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

/** Cam kết hoàn tiền: hiện mã đơn + cách liên hệ, chỉ trong thời gian cam kết. */
function refundPanel(card) {
  const { code, paidAt } = card.paidOrder;
  const until = new Date(paidAt + GUARANTEE.hours * 60 * 60 * 1000);
  return el('details', { class: 'panel refund-panel' }, [
    el('summary', { text: '🛡️ Không ưng ý? Yêu cầu hoàn tiền' }),
    el('p', { class: 'small', text: `Bạn được hoàn 100% nếu nhắn trước ${until.toLocaleString('vi-VN', { timeStyle: 'short', dateStyle: 'short' })}. Sau khi hoàn tiền, thiệp sẽ bị gỡ và người nhận không mở được nữa.` }),
    el('p', { class: 'small' }, [el('span', { text: 'Gửi kèm mã đơn: ' }), el('strong', { text: code })]),
    el('div', { class: 'share-actions' }, [
      el('button', { class: 'btn btn-soft btn-sm', text: 'Sao chép mã đơn', attrs: { type: 'button' }, on: { click: () => copyText(code) } }),
      el('a', { class: 'btn btn-ghost btn-sm', text: '💬 Nhắn hỗ trợ', attrs: { href: '/ho-tro' } }),
    ]),
  ]);
}

/** Kết quả câu đố: điểm + từng câu người nhận đã chọn. */
function quizResult(card, r) {
  const quiz = card.data.game?.quiz || [];
  return el('div', { class: 'answer-item' }, [
    el('p', { class: 'answer-main' }, [el('strong', { text: `💯 Câu đố: ${r.score}/${r.total} · ${quizVerdict(r.score, r.total)}` })]),
    ...quiz.map((q, i) => {
      const picked = q.options[r.answers?.[i]] ?? '—';
      const ok = r.answers?.[i] === q.answer;
      return el('p', { class: 'small', text: `${ok ? '✅' : '❌'} ${q.q} → ${picked}${ok ? '' : ` (đúng: ${q.options[q.answer]})`}` });
    }),
    el('p', { class: 'muted small', text: `Lúc ${when(r.createdAt)}` }),
  ]);
}

/** Câu trả lời (mẫu "Đi chơi") và thư đáp lại của người nhận, mới nhất trước. */
function responsesPanel(card) {
  const list = card.responses.map((r) =>
    r.kind === 'vong-quay'
      ? el('div', { class: 'answer-item' }, [
          el('p', { class: 'answer-main' }, [el('strong', { text: `🎡 Quay trúng: ${r.prize}` })]),
          el('p', { class: 'muted small', text: `Lúc ${when(r.createdAt)} · nhớ thực hiện nha 😉` }),
        ])
      : r.kind === 'cau-do'
      ? quizResult(card, r)
      : r.kind === 'reply'
      ? el('div', { class: 'answer-item' }, [
          el('p', { class: 'answer-note', text: `💌 “${r.text}”` }),
          el('p', { class: 'muted small', text: `Gửi lúc ${when(r.createdAt)}` }),
        ])
      : el('div', { class: 'answer-item' }, [
          el('p', { class: 'answer-main' }, [el('strong', { text: `📅 ${answerDate(r.date)}` }), el('span', { text: ` · ${r.food}` })]),
          r.note ? el('p', { class: 'answer-note', text: `“${r.note}”` }) : null,
          el('p', { class: 'muted small', text: `Trả lời lúc ${when(r.createdAt)}` }),
        ]),
  );
  return el('section', { class: 'panel' }, [
    el('h2', { text: `💬 ${card.data.recipientName} nhắn lại` }),
    list.length
      ? el('div', { class: 'answer-list' }, list)
      : el('p', { class: 'muted small', text: 'Chưa có lời nhắn nào. Tải lại trang này để xem lời nhắn mới.' }),
  ]);
}

/** Người nhận đã phản ứng thế nào: mở lúc nào, bấm "Có" sau bao nhiêu lần né… */
const YES_LABEL = {
  'to-tinh': ['Đã bấm "Có" 💘', 'lần né nút "Không"'],
  'xin-loi': ['Đã tha lỗi 🥰', 'lần bấm "Không tha"'],
  'di-choi': ['Đã chốt kèo 🎟️', 'lần kêu "bận"'],
  'o-canh-em': ['Hai trái tim đã chạm nhau 🫂', 'lần lỡ buông tay'],
  'sinh-nhat': ['Đã thổi nến, ước xong 🎂', null],
  'chuyen-tinh': ['Đã móc ngoéo hứa với bạn 🤙', null],
  'so-tay': ['Đã mở cuốn sổ 📔', null],
};
function reactionsPanel(card) {
  const r = card.reactions;
  const seconds = (ms) => (ms < 60000 ? `${Math.round(ms / 1000)} giây` : `${Math.floor(ms / 60000)} phút ${Math.round((ms % 60000) / 1000)} giây`);
  const [yesText, noLabel] = YES_LABEL[card.template] || ['Đã xem hết thiệp ✓', null];
  const rows = [];
  if (!r.firstOpenedAt) rows.push(el('p', { class: 'muted', text: '👀 Người nhận chưa mở thiệp.' }));
  else {
    rows.push(el('p', {}, [el('strong', { text: '👀 Đã mở thiệp ' }), el('span', { text: `· lần đầu ${when(r.firstOpenedAt)}, gần nhất ${when(r.lastOpenedAt)}` })]));
    if (r.yesAt) {
      rows.push(el('p', {}, [el('strong', { text: yesText }), el('span', { text: ` · lúc ${when(r.yesAt)}` })]));
      if (noLabel && r.noPresses !== null) rows.push(el('p', { text: `😆 ${r.noPresses} ${noLabel} · suy nghĩ ${seconds(r.thinkMs || 0)}` }));
    } else rows.push(el('p', { class: 'muted', text: 'Người nhận chưa xem tới cuối thiệp.' }));
  }
  return el('section', { class: 'panel reactions' }, [
    el('h2', { text: '📡 Phản ứng của người nhận' }),
    ...rows,
    el('p', { class: 'muted small', text: 'Nếu bạn tự mở link để thử, lượt đó cũng được tính.' }),
  ]);
}

/** Thiệp nhóm: danh sách lời chúc, người tổ chức xóa được lời chúc không phù hợp. */
function signaturesPanel(card) {
  const list = el('div', { class: 'answer-list' });
  const draw = (sigs) => {
    list.replaceChildren(
      ...(sigs.length
        ? sigs.map((s) =>
            el('div', { class: 'answer-item sig-item' }, [
              el('p', { class: 'answer-main' }, [el('strong', { text: `${s.sticker} ${s.name}` })]),
              el('p', { class: 'answer-note', text: s.message }),
              el('button', {
                class: 'btn btn-ghost btn-sm',
                text: 'Xóa',
                attrs: { type: 'button' },
                on: {
                  click: async (e) => {
                    if (!confirm(`Xóa lời chúc của ${s.name}?`)) return;
                    const btn = e.currentTarget;
                    btn.disabled = true;
                    try {
                      const view = await deleteSignature(slug, token, s.id);
                      draw(view.signatures);
                      toast('Đã xóa');
                    } catch (err) {
                      toast(err.message, 4000);
                      btn.disabled = false;
                    }
                  },
                },
              }),
            ]),
          )
        : [el('p', { class: 'muted small', text: 'Chưa ai ký. Gửi link mời ở trên vào nhóm nhé!' })]),
    );
  };
  draw(card.signatures);
  return el('section', { class: 'panel' }, [el('h2', { text: `💐 Lời chúc của cả nhóm (tối đa ${card.maxSignatures})` }), list]);
}

/** Các tính năng đặc biệt người tạo đã bật: hẹn giờ, mở cùng nhau, giọng nói, video phản ứng, sổ tình yêu. */
function specialPanels(card) {
  const d = card.data;
  const out = [];
  if (d.openAt) {
    out.push(el('section', { class: 'panel' }, [el('h2', { text: '⏰ Hẹn giờ mở' }), el('p', { text: `Thiệp mở lúc ${formatOpenAt(d.openAt)} (giờ Việt Nam). Trước đó người nhận chỉ thấy đồng hồ đếm ngược.` })]));
  }
  if (d.together) {
    out.push(
      el('section', { class: 'panel' }, [
        el('h2', { text: '💞 Mở cùng nhau' }),
        el('p', { class: 'small', text: `Hẹn ${d.recipientName} một giờ, gọi video cho nhau, rồi cả hai cùng bấm "Mình sẵn sàng". Bạn mở phía mình bằng nút dưới đây (đừng gửi nút này cho ai).` }),
        el('a', { class: 'btn btn-primary', text: '💞 Mở phía của mình', attrs: { href: `/t/${encodeURIComponent(slug)}?cung=gui#${encodeURIComponent(token)}` } }),
      ]),
    );
  }
  if (d.voice) {
    out.push(
      el('section', { class: 'panel' }, [
        el('h2', { text: '🎙️ Lời nhắn giọng nói của bạn' }),
        el('audio', { attrs: { controls: '', preload: 'none', src: `/api/giong-noi/${encodeURIComponent(slug)}` } }),
      ]),
    );
  }
  if (d.reactionCam) {
    const box = el('div', { class: 'reaction-video' });
    if (card.reactionAt) {
      const btn = el('button', {
        class: 'btn btn-primary',
        text: '▶ Xem video phản ứng',
        attrs: { type: 'button' },
        on: {
          click: async () => {
            btn.disabled = true;
            try {
              const url = URL.createObjectURL(await fetchReaction(slug, token));
              box.replaceChildren(
                el('video', { attrs: { controls: '', playsinline: '', autoplay: '', src: url } }),
                el('a', { class: 'btn btn-soft btn-sm', text: '⬇️ Lưu video', attrs: { href: url, download: 'phan-ung.mp4' } }),
              );
            } catch (e) {
              toast(e.message);
              btn.disabled = false;
            }
          },
        },
      });
      box.append(el('p', { text: `🎉 ${d.recipientName} đã gửi video phản ứng lúc ${new Date(card.reactionAt).toLocaleString('vi-VN')}.` }), btn);
    } else {
      box.append(el('p', { class: 'muted', text: 'Chưa có video. Người nhận có thể chưa mở thiệp, hoặc đã chọn không quay (đó là quyền của họ nha).' }));
    }
    out.push(el('section', { class: 'panel' }, [el('h2', { text: '📹 Video phản ứng' }), box]));
  }
  if (card.memories) out.push(memoriesPanel(card));
  return out;
}

/** Sổ tình yêu chung: xem các trang hai người đã viết, xóa trang không muốn giữ. */
function memoriesPanel(card) {
  const list = el('div', { class: 'answer-list' });
  const draw = (items) =>
    list.replaceChildren(
      ...(items.length
        ? items.map((m) =>
            el('div', { class: 'answer' }, [
              el('p', { class: 'small muted', text: `${m.author === 'gui' ? card.data.senderName : card.data.recipientName} · ${new Date(m.createdAt).toLocaleString('vi-VN')}${m.hasImage ? ' · có ảnh' : ''}` }),
              el('p', { text: m.text }),
              el('button', {
                class: 'btn btn-ghost btn-sm',
                text: '🗑️ Xóa trang này',
                attrs: { type: 'button' },
                on: {
                  click: async () => {
                    if (!confirm('Xóa trang này khỏi sổ?')) return;
                    try {
                      await deleteMemory(slug, token, m.id);
                      draw(items.filter((x) => x.id !== m.id));
                      toast('Đã xóa trang');
                    } catch (e) {
                      toast(e.message);
                    }
                  },
                },
              }),
            ]),
          )
        : [el('p', { class: 'muted small', text: 'Chưa có trang nào được viết thêm. Nhắc người ấy mở link và viết nhé!' })]),
    );
  draw(card.memories);
  return el('section', { class: 'panel' }, [el('h2', { text: `📔 Sổ tình yêu chung (${card.memories.length} trang viết thêm)` }), list]);
}

/** Gói Cơ bản: trả thêm phần chênh lệch để lên gói Đặc biệt (link giữ nguyên). */
function upgradePanel(card) {
  const to = PLANS[UPGRADE.to];
  const btn = el('button', { class: 'btn btn-primary', text: `💎 Nâng cấp chỉ ${formatVnd(upgradePrice())}`, attrs: { type: 'button' } });
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      const order = await createUpgrade(slug, token);
      const info = { slug, editToken: token, template: card.template, recipientName: card.data.recipientName };
      saveOrderInfo(order.code, info);
      location.href = `/thanh-toan/${order.code}#${encodeOrderHash(info)}`;
    } catch (e) {
      toast(e.message, 4000);
      btn.disabled = false;
    }
  });
  return el('section', { class: 'panel upsell-panel' }, [
    el('h2', { text: `💎 Nâng cấp lên gói ${to.name}` }),
    el('ul', { class: 'small' }, [
      el('li', { text: 'Sửa lời nhắn bất cứ lúc nào, người nhận mở lại là thấy' }),
      el('li', { text: `Link dùng thêm ${to.days} ngày tính từ hôm nay` }),
      el('li', { text: 'Mã QR của link để in kèm quà' }),
    ]),
    el('p', { class: 'muted small', text: 'Link thiệp giữ nguyên, người nhận không thấy gì thay đổi.' }),
    btn,
  ]);
}

function render(card) {
  const tpl = TEMPLATES[card.template];
  const plan = PLANS[card.plan];
  const [statusText, statusClass] = STATUS[card.status] || [card.status, 'badge-off'];
  const children = [
    el('p', { class: 'muted small', text: 'Trang quản lý thiệp' }),
    el('h1', { text: `${tpl?.emoji || '💌'} Gửi ${card.data.recipientName}` }),
    el('span', { class: `badge ${statusClass}`, text: statusText }),
    el('div', { class: 'stats' }, [
      stat('lượt mở', String(card.views)),
      stat('gói', plan?.name || card.plan),
      stat('hết hạn', card.expiresAt ? formatDate(card.expiresAt) : '—'),
    ]),
  ];

  if (card.signatures && (card.status === 'draft' || card.status === 'active')) {
    children.push(invitePanel({ slug, editToken: token, groupName: card.data.texts.groupName }), signaturesPanel(card));
  }

  if (card.status === 'draft' && card.pendingOrderCode) {
    children.push(
      el('section', { class: 'panel' }, [
        el('p', { text: 'Thiệp chưa được thanh toán nên người nhận chưa mở được.' }),
        el('a', {
          class: 'btn btn-primary',
          text: 'Thanh toán ngay',
          attrs: { href: `/thanh-toan/${card.pendingOrderCode}#${encodeOrderHash({ slug, editToken: token })}` },
        }),
      ]),
    );
  } else if (card.status === 'draft') {
    children.push(el('p', { class: 'panel', text: 'Đơn thanh toán đã hết hạn. Bạn tạo lại thiệp từ trang chủ hoặc nhắn hỗ trợ nếu đã chuyển khoản nhé.' }));
  }

  if (card.status === 'active') {
    children.push(sharePanel({ slug, plan: card.plan, recipientName: card.data.recipientName, senderName: card.data.senderName }));
    children.push(reactionsPanel(card));
    children.push(...specialPanels(card));
    if (card.responses.length || card.template === 'di-choi' || card.data.game?.id) children.push(responsesPanel(card));
    if (card.plan === 'combo') children.push(comboPanel(token));
    if (card.paidOrder && withinGuarantee(card.plan, card.paidOrder.paidAt)) children.push(refundPanel(card));
    if (card.canEdit) children.push(editForm(card));
    if (card.plan === UPGRADE.from) children.push(upgradePanel(card));
  }

  children.push(
    el('section', { class: 'panel panel-warn' }, [
      el('p', { class: 'small', text: '🔑 Lưu link trang này lại (ghim tin nhắn, lưu vào ghi chú…). Đừng gửi cho người nhận.' }),
      el('button', {
        class: 'btn btn-soft btn-sm',
        text: 'Sao chép link quản lý',
        attrs: { type: 'button' },
        on: { click: () => copyText(manageLink(slug, token)) },
      }),
    ]),
  );
  page(children);
}

async function start() {
  try {
    if (!slug || !token) throw new Error('Link quản lý bị thiếu phần sau dấu #. Bạn sao chép lại đầy đủ link nhé.');
    const card = await getManage(slug, token);
    if (card.status === 'active' || card.status === 'draft') {
      rememberMyCard({ slug, editToken: token, recipientName: card.data.recipientName, template: card.template, plan: card.plan });
    }
    render(card);
  } catch (e) {
    page([
      el('h1', { text: 'Không mở được trang quản lý' }),
      el('p', { text: e.message }),
      el('a', { class: 'btn btn-primary', text: 'Về trang chủ', attrs: { href: '/' } }),
    ]);
  }
}

start();
