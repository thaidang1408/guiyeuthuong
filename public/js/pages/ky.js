// Trang /ky/<slug>#<mã mời> — thành viên trong nhóm ký tên và viết lời chúc vào thiệp chung.
import { groupInfo, signGroup } from '../core/api.js';
import { el, qs, toast } from '../core/dom.js';
import { textField } from '../core/form.js';

const STICKERS = ['💐', '🌷', '🌸', '💖', '🎉', '🥰', '🌟', '🍀'];
const app = qs('#app');
const slug = location.pathname.split('/')[2] || '';
const token = decodeURIComponent(location.hash.slice(1)).toUpperCase();
const doneKey = `da-ky:${slug}`;

function alreadySigned() {
  try {
    return localStorage.getItem(doneKey);
  } catch {
    return null;
  }
}

function signedNames(info) {
  return info.names.length
    ? el('p', { class: 'small' }, [el('strong', { text: `${info.count} người đã ký: ` }), el('span', { text: info.names.join(', ') })])
    : el('p', { class: 'muted small', text: 'Bạn là người ký đầu tiên đó!' });
}

function renderDone(info, name) {
  app.replaceChildren(
    el('h1', { text: 'Đã ký tên ✓ 🎉' }),
    el('p', { class: 'lead', text: `Cảm ơn ${name}! Lời chúc của bạn sẽ hiện trong thiệp gửi ${info.recipientName}.` }),
    el('section', { class: 'panel' }, [signedNames(info)]),
    el('section', { class: 'panel' }, [
      el('p', { text: 'Muốn tự tạo một tấm thiệp nhóm, hay thiệp riêng gửi người thương? 💌' }),
      el('a', { class: 'btn btn-primary', text: 'Tạo thiệp của bạn', attrs: { href: '/' } }),
    ]),
  );
}

function renderForm(info) {
  const sig = { name: '', message: '', sticker: STICKERS[0] };
  const stickerRow = el('div', { class: 'chips sticker-row', attrs: { role: 'radiogroup', 'aria-label': 'Chọn nhãn dán' } });
  for (const s of STICKERS) {
    const b = el('button', { class: 'chip' + (s === sig.sticker ? ' selected' : ''), text: s, attrs: { type: 'button', role: 'radio' } });
    b.addEventListener('click', () => {
      sig.sticker = s;
      for (const c of stickerRow.children) c.classList.toggle('selected', c === b);
    });
    stickerRow.append(b);
  }
  const submit = el('button', { class: 'btn btn-primary', text: 'Gửi lời chúc 💐', attrs: { type: 'submit' } });
  const form = el('form', { class: 'panel' }, [
    textField({ label: 'Tên của bạn', max: 40, placeholder: 'Ví dụ: Minh Anh' }, '', (v) => (sig.name = v)).wrap,
    textField({ label: `Lời chúc gửi ${info.recipientName}`, max: 300, multiline: true, placeholder: 'Viết vài dòng thật lòng nhé…' }, '', (v) => (sig.message = v)).wrap,
    el('div', { class: 'field' }, [el('span', { class: 'field-label', text: 'Chọn một nhãn dán' }), stickerRow]),
    submit,
  ]);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submit.disabled = true;
    try {
      const after = await signGroup(slug, token, sig);
      try {
        localStorage.setItem(doneKey, sig.name.trim());
      } catch {
        /* không sao */
      }
      renderDone(after, sig.name.trim());
    } catch (err) {
      toast(err.message, 4000);
      submit.disabled = false;
    }
  });

  const full = info.count >= info.max;
  app.replaceChildren(
    el('p', { class: 'muted small', text: info.groupName ? `Thiệp chung của ${info.groupName}` : 'Thiệp chung' }),
    el('h1', { text: `✍️ Cùng ký tên gửi ${info.recipientName}` }),
    el('p', { text: `${info.senderName} đang gom lời chúc của cả nhóm vào một tấm thiệp. Viết vài dòng và ký tên của bạn nhé!` }),
    signedNames(info),
    full ? el('p', { class: 'panel', text: `Thiệp đã đủ ${info.max} lời chúc rồi. Bạn nhắn ${info.senderName} nếu muốn gửi thêm nhé.` }) : form,
    el('p', { class: 'muted small', text: 'Lời chúc chỉ người nhận thấy khi mở thiệp, và người tổ chức thấy để kiểm tra.' }),
  );
}

async function start() {
  try {
    if (!slug || !token) throw new Error('Link mời bị thiếu phần sau dấu #. Bạn xin lại link đầy đủ nhé.');
    const info = await groupInfo(slug, token);
    const name = alreadySigned();
    if (name) renderDone(info, name);
    else renderForm(info);
  } catch (e) {
    app.replaceChildren(
      el('h1', { text: 'Không mở được link ký tên' }),
      el('p', { text: e.message }),
      el('a', { class: 'btn btn-primary', text: 'Về trang chủ', attrs: { href: '/' } }),
    );
  }
}

start();
