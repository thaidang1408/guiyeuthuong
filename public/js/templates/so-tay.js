// Mẫu "Sổ tình yêu chung": một cuốn sổ online của hai người. Trang đầu do người tạo viết (kèm ảnh),
// sau đó CẢ HAI cùng viết thêm trang (chữ + 1 ảnh) bất cứ lúc nào, mở lại link là thấy cả chặng đường.
// Bản xem thử: trang viết thêm chỉ nằm trên máy, không gửi đi.
import { addMemory, listMemories } from '../core/api.js';
import { el, toast } from '../core/dom.js';
import { compressImage } from '../core/image-compress.js';
import { sfx } from '../core/sfx.js';
import { MEMORY_BOOK } from '../shared/extras.js';
import { introScreen, screen, swap } from './common.js';

const DAY = 24 * 60 * 60 * 1000;

/** ctx: { data, slug, imageUrls, preview, onStart(), onFinish() }; data.texts: loveStart, bookTitle, firstPage */
export function render(stage, ctx) {
  const { data } = ctx;
  swap(
    stage,
    introScreen({
      emoji: '📔',
      name: data.recipientName,
      sub: `${data.pr.Toi} mở một cuốn sổ cho hai đứa mình nè`,
      button: 'Mở sổ ra xem 📖',
      onOpen: () => {
        ctx.onStart();
        showBook(stage, ctx);
      },
    }),
  );
}

function daysSince(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return null;
  const now = new Date();
  const d = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(+m[1], +m[2] - 1, +m[3])) / DAY);
  return d >= 0 ? d : null;
}

const fmt = (ms) => new Date(ms).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

function showBook(stage, ctx) {
  const { data } = ctx;
  const slug = ctx.slug;
  const names = { gui: data.senderName, nhan: data.recipientName };
  const days = daysSince(data.texts.loveStart);
  const pages = el('div', { class: 'st-pages' });
  const local = []; // bản xem thử: trang viết thêm chỉ lưu tạm ở đây

  const page = (entry, i) => {
    const img = entry.image
      ? el('img', { class: 'st-photo', attrs: { src: entry.image, alt: '', loading: 'lazy' } })
      : null;
    return el('article', { class: 'st-page' + (entry.author === 'gui' ? ' from-gui' : ' from-nhan') }, [
      el('header', { class: 'st-page-head' }, [
        el('span', { class: 'st-page-no', text: `Trang ${i + 1}` }),
        el('span', { class: 'st-page-meta', text: `✍️ ${names[entry.author] || ''}${entry.createdAt ? ' · ' + fmt(entry.createdAt) : ''}` }),
      ]),
      img,
      el('p', { class: 'st-text', text: entry.text }),
    ]);
  };

  const first = {
    author: 'gui',
    text: data.texts.firstPage,
    createdAt: null,
    image: ctx.imageUrls[0] || null,
  };
  // Ảnh còn lại của người tạo: mỗi ảnh thêm một trang nhỏ ngay sau trang đầu.
  const extraPhotos = ctx.imageUrls.slice(1).map((src) => ({ author: 'gui', text: '', image: src, createdAt: null }));

  const renderPages = (entries) => {
    const all = [first, ...extraPhotos, ...entries];
    pages.replaceChildren(...all.map((e, i) => page(e, i)));
  };

  const load = async () => {
    if (ctx.preview || !slug) return renderPages(local);
    try {
      const { memories } = await listMemories(slug);
      renderPages(memories.map(toEntry));
    } catch {
      renderPages([]);
    }
  };
  const toEntry = (m) => ({
    author: m.author,
    text: m.text,
    createdAt: m.createdAt,
    image: m.hasImage ? `/api/so-tay/${encodeURIComponent(slug)}/anh/${m.id}` : null,
  });

  swap(
    stage,
    screen('st-book', [
      el('div', { class: 'st-cover' }, [
        el('span', { class: 'st-cover-emoji', text: '📔', attrs: { 'aria-hidden': 'true' } }),
        el('h1', { class: 'st-title', text: data.texts.bookTitle }),
        el('p', { class: 'st-names', text: `${data.senderName} ❤ ${data.recipientName}` }),
        days !== null ? el('p', { class: 'st-days', text: `💕 Đã bên nhau ${days.toLocaleString('vi-VN')} ngày` }) : null,
      ]),
      pages,
      writeForm(ctx, names, async (entry) => {
        if (ctx.preview || !slug) {
          local.push({ ...entry, createdAt: Date.now() });
          renderPages(local);
          toast('Bản xem thử: trang này chỉ nằm trên máy bạn 😉', 3000);
          return;
        }
        const { memories } = await addMemory(slug, entry);
        renderPages(memories.map(toEntry));
      }),
    ]),
  );
  load();
  ctx.onFinish();
}

/** Ô "Viết thêm một trang": chọn mình là ai, viết vài dòng, thêm 1 ảnh (nén trên máy). */
function writeForm(ctx, names, submit) {
  const key = `so-tay-tac-gia:${ctx.slug || 'xem-thu'}`;
  let author = 'nhan';
  try {
    author = localStorage.getItem(key) || 'nhan';
  } catch {
    /* bỏ qua */
  }
  const who = el('div', { class: 'chips' });
  const renderWho = () =>
    who.replaceChildren(
      ...['nhan', 'gui'].map((side) =>
        el('button', {
          class: 'chip' + (author === side ? ' selected' : ''),
          text: `Mình là ${names[side]}`,
          attrs: { type: 'button' },
          on: {
            click: () => {
              author = side;
              try {
                localStorage.setItem(key, side);
              } catch {
                /* bỏ qua */
              }
              renderWho();
            },
          },
        }),
      ),
    );
  renderWho();

  const text = el('textarea', { class: 'input', attrs: { rows: '4', maxlength: String(MEMORY_BOOK.textMax), placeholder: 'Hôm nay của tụi mình thế nào? Viết lại một kỷ niệm nhé…' } });
  const file = el('input', { attrs: { type: 'file', accept: 'image/*', hidden: '' } });
  let photo = null;
  const photoBtn = el('button', { class: 'btn btn-soft btn-sm', text: '🖼️ Thêm 1 ảnh', attrs: { type: 'button' }, on: { click: () => file.click() } });
  file.addEventListener('change', async () => {
    const f = file.files[0];
    file.value = '';
    if (!f) return;
    try {
      photo = await compressImage(f);
      photoBtn.textContent = '✅ Đã chọn ảnh (bấm để đổi)';
    } catch {
      toast('Ảnh này không đọc được, bạn chọn ảnh khác nhé.');
    }
  });
  const send = el('button', { class: 'btn btn-primary', text: '📝 Thêm vào sổ', attrs: { type: 'submit' } });
  const form = el('form', { class: 'st-write' }, [
    el('h2', { text: '✍️ Viết thêm một trang' }),
    el('p', { class: 'muted small', text: 'Cả hai đều viết được, mở lại link này bất cứ lúc nào.' }),
    who,
    text,
    el('div', { class: 'share-actions' }, [photoBtn, send]),
    file,
  ]);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!text.value.trim()) return text.focus();
    send.disabled = true;
    try {
      const image = photo ? (ctx.preview ? URL.createObjectURL(photo) : photo) : null;
      await submit({ author, text: text.value.trim(), image });
      text.value = '';
      photo = null;
      photoBtn.textContent = '🖼️ Thêm 1 ảnh';
      sfx.chime(0.16);
      toast('Đã thêm vào sổ 📔');
      form.previousElementSibling?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
      toast(err.message, 4000);
    }
    send.disabled = false;
  });
  return form;
}
