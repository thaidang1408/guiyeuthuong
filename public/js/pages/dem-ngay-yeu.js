// /dem-ngay-yeu — công cụ miễn phí (kéo khách từ Google): đếm ngày yêu, cột mốc sắp tới, tạo link gửi người ấy.
// Không lưu gì trên server: tên và ngày nằm ngay trong link (?a=…&b=…&d=YYYY-MM-DD).
import { copyText, el, qs, toast } from '../core/dom.js';

const app = qs('#app');
const DAY = 24 * 60 * 60 * 1000;
const MILESTONE_DAYS = [100, 200, 300, 365, 500, 700, 730, 1000, 1095, 1500, 2000, 2500, 3000, 3650, 5000];
const clip = (s, n) => [...String(s ?? '').trim()].slice(0, n).join('');

function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getTime() <= Date.now() ? d : null;
}

function nextMilestones(start) {
  const days = Math.floor((Date.now() - start.getTime()) / DAY);
  const list = MILESTONE_DAYS.filter((d) => d > days).slice(0, 2).map((d) => ({ label: `${d.toLocaleString('vi-VN')} ngày`, at: new Date(start.getTime() + d * DAY) }));
  // Kỷ niệm năm tiếp theo
  const years = new Date().getFullYear() - start.getFullYear();
  for (let y = Math.max(1, years); y <= years + 1; y++) {
    const at = new Date(start.getFullYear() + y, start.getMonth(), start.getDate());
    if (at.getTime() > Date.now()) {
      list.push({ label: `kỷ niệm ${y} năm`, at });
      break;
    }
  }
  return list.sort((a, b) => a.at - b.at).slice(0, 3);
}

function showCounter(a, b, start, isOwner) {
  const days = el('p', { class: 'tool-big' });
  const detail = el('p', { class: 'tool-detail' });
  const tick = () => {
    const ms = Date.now() - start.getTime();
    days.textContent = `${Math.floor(ms / DAY).toLocaleString('vi-VN')} ngày`;
    detail.textContent = `${Math.floor((ms % DAY) / 3600000)} giờ ${Math.floor((ms % 3600000) / 60000)} phút ${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')} giây`;
  };
  tick();
  setInterval(tick, 1000);

  // Link gửi đi bỏ dấu "cua=1" (đánh dấu người tạo) để người nhận không thấy nút chia sẻ.
  const shareParams = new URLSearchParams(location.search);
  shareParams.delete('cua');
  const link = `${location.origin}${location.pathname}?${shareParams}`;
  const milestones = nextMilestones(start).map((m) => {
    const left = Math.ceil((m.at - Date.now()) / DAY);
    return el('li', { text: `Còn ${left} ngày nữa là ${m.label} (${m.at.toLocaleDateString('vi-VN')})` });
  });

  app.replaceChildren(
    el('section', { class: 'tool-hero' }, [
      el('p', { class: 'tool-names hand', text: `${a} 💞 ${b}` }),
      el('p', { class: 'muted', text: 'đã bên nhau' }),
      days,
      detail,
      el('p', { class: 'muted small', text: `kể từ ${start.toLocaleDateString('vi-VN')}` }),
    ]),
    milestones.length ? el('section', { class: 'panel' }, [el('h2', { text: '🎯 Cột mốc sắp tới' }), el('ul', {}, milestones)]) : '',
    isOwner
      ? el('section', { class: 'panel' }, [
          el('h2', { text: 'Gửi cho người ấy' }),
          el('div', { class: 'share-actions' }, [
            el('button', { class: 'btn btn-primary', text: '📋 Sao chép link', attrs: { type: 'button' }, on: { click: () => copyText(link) } }),
            navigator.share
              ? el('button', { class: 'btn btn-soft', text: '📤 Chia sẻ', attrs: { type: 'button' }, on: { click: () => navigator.share({ title: 'Mình đã yêu nhau bao lâu rồi? 💞', url: link }).catch(() => {}) } })
              : null,
          ]),
        ])
      : '',
    upsell(),
    el('p', { class: 'center' }, [el('a', { class: 'btn btn-ghost btn-sm', text: 'Tạo bộ đếm của riêng bạn', attrs: { href: '/dem-ngay-yeu' } })]),
  );
}

/** Lời mời sang thiệp trả phí: có cái ôm, ảnh, nhạc, đếm ngược lần gặp tới. */
function upsell() {
  return el('section', { class: 'panel tool-upsell' }, [
    el('h2', { text: '🫂 Muốn tặng kèm một cái ôm?' }),
    el('p', { text: 'Thiệp "Muốn ở cạnh nhau": giữ tay lên màn hình để hai trái tim chạm nhau, kèm đếm ngày yêu, ảnh kỷ niệm, nhạc nền và đếm ngược tới lần gặp tới. Chỉ từ 15.000đ.' }),
    el('div', { class: 'share-actions' }, [
      el('a', { class: 'btn btn-ghost', text: 'Xem thử', attrs: { href: '/xem-truoc?demo=o-canh-em' } }),
      el('a', { class: 'btn btn-primary', text: 'Tạo thiệp này', attrs: { href: '/tao?mau=o-canh-em' } }),
    ]),
  ]);
}

function showForm() {
  const a = el('input', { class: 'input', attrs: { maxlength: '30', placeholder: 'Ví dụ: Tớ', required: '' } });
  const b = el('input', { class: 'input', attrs: { maxlength: '30', placeholder: 'Ví dụ: Ẻm, Người ấy…', required: '' } });
  const d = el('input', { class: 'input', attrs: { type: 'date', required: '', max: new Date().toISOString().slice(0, 10) } });
  const form = el('form', { class: 'panel' }, [
    el('label', { class: 'field' }, [el('span', { class: 'field-label', text: 'Tên bạn' }), a]),
    el('label', { class: 'field' }, [el('span', { class: 'field-label', text: 'Tên người ấy' }), b]),
    el('label', { class: 'field' }, [el('span', { class: 'field-label', text: 'Ngày bắt đầu yêu' }), d]),
    el('button', { class: 'btn btn-primary', text: 'Xem đã yêu bao lâu 💞', attrs: { type: 'submit' } }),
  ]);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const start = parseDate(d.value);
    if (!start) return toast('Ngày bắt đầu yêu phải là một ngày đã qua nhé.');
    const params = new URLSearchParams({ a: clip(a.value, 30), b: clip(b.value, 30), d: d.value, cua: '1' });
    history.replaceState(null, '', `?${params}`);
    showCounter(clip(a.value, 30), clip(b.value, 30), start, true);
  });
  app.append(form, upsell());
}

const q = new URLSearchParams(location.search);
const start = parseDate(q.get('d'));
if (start && q.get('a') && q.get('b')) showCounter(clip(q.get('a'), 30), clip(q.get('b'), 30), start, q.get('cua') === '1');
else showForm();
