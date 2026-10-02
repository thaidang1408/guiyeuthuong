// Trang /xem-truoc — chạy hoàn toàn trên trình duyệt, ảnh dùng blob URL, chưa gửi gì lên server.
//   /xem-truoc?mau=<id>   xem bản nháp đang làm
//   /xem-truoc?demo=<id>  xem mẫu với nội dung ví dụ (dùng ở trang chủ); thêm &fx=<màn kết>&mo=<màn mở đầu> để thử hiệu ứng
//   /xem-truoc?hieu-ung=<màn kết>  xem riêng một màn kết đặc biệt
import { showCountdown } from '../card/countdown.js';
import { demoPhotos, mountCard } from '../card/player.js';
import { openAtMs } from '../shared/schedule.js';
import { BACKGROUNDS, FINALES, FX_PHRASE_MAX, OPENINGS, defaultPhrase } from '../shared/effects.js';
import { GAMES, defaultGame } from '../shared/games.js';
import { el, qs } from '../core/dom.js';
import { imageToBlob, lastTemplate, loadDraft } from '../core/draft-store.js';
import { TEMPLATES, defaultCardData, templateForEffect } from '../shared/templates.js';

const root = qs('#app');
const params = new URLSearchParams(location.search);

/** Ô nào còn trống thì dùng chữ mặc định, để bản xem trước luôn đẹp. */
function withFallbacks(templateId, data) {
  const defaults = defaultCardData(templateId, data.relationship, data.pronoun);
  const texts = { ...defaults.texts };
  for (const [k, v] of Object.entries(data.texts || {})) if (v && v.trim()) texts[k] = v;
  return {
    ...defaults,
    ...data,
    recipientName: data.recipientName?.trim() || 'Người ấy',
    senderName: data.senderName?.trim() || 'Ai đó',
    texts,
  };
}

/** Ô ngày để trống mặc định; bản xem thử điền ngày ví dụ để thấy được bộ đếm. */
function demoTexts(templateId) {
  if (templateId === 'chuyen-tinh' || templateId === 'so-tay') {
    const d = new Date();
    d.setDate(d.getDate() - 1000);
    return { loveStart: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` };
  }
  if (templateId !== 'o-canh-em') return {};
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const now = new Date();
  return {
    loveStart: iso(new Date(now.getFullYear() - 2, now.getMonth(), now.getDate() - 40)),
    nextMeet: iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3)),
  };
}

function showMissing() {
  root.replaceChildren(
    el('main', { class: 'empty-state' }, [
      el('div', { class: 'empty-emoji', text: '📝' }),
      el('h1', { text: 'Chưa có bản nháp nào' }),
      el('p', { text: 'Bạn chọn một mẫu thiệp rồi bấm "Xem trước" nhé.' }),
      el('a', { class: 'btn btn-primary', text: 'Chọn mẫu thiệp', attrs: { href: '/' } }),
    ]),
  );
}

/** Trang chủ bấm "Xem thử" một màn kết: người xem tự nhập tên, câu yêu thương, ảnh rồi chạy thử hiệu ứng. */
const DEMO_KEY = 'xem-thu-hieu-ung';
const DEMO_LIMITS = { name: 40, phrase: FX_PHRASE_MAX, lines: 120, photos: 6 };

function loadDemoInput() {
  try {
    return { name: 'Người ấy', sender: 'Tớ', phrase: '', lines: 'Cảm ơn cậu đã đến\nMỗi ngày đều nhớ cậu\nMãi là của nhau nhé', ...JSON.parse(sessionStorage.getItem(DEMO_KEY) || '{}') };
  } catch {
    return { name: 'Người ấy', sender: 'Tớ', phrase: '', lines: '' };
  }
}

function showEffect(info) {
  const v = loadDemoInput();
  let photos = []; // blob URL ảnh người xem chọn, chỉ nằm trên máy này
  const save = () => {
    try {
      sessionStorage.setItem(DEMO_KEY, JSON.stringify({ name: v.name, sender: v.sender, phrase: v.phrase, lines: v.lines }));
    } catch {
      /* bỏ qua */
    }
  };
  const field = (label, key, { max, placeholder, multiline } = {}) => {
    const input = el(multiline ? 'textarea' : 'input', {
      class: 'input',
      attrs: { maxlength: String(max), placeholder: placeholder || '', ...(multiline ? { rows: '3' } : { type: 'text' }) },
    });
    input.value = v[key];
    input.addEventListener('input', () => ((v[key] = input.value), save()));
    return el('label', { class: 'field' }, [el('span', { class: 'field-label', text: label }), input]);
  };

  const photoInput = el('input', { attrs: { type: 'file', accept: 'image/*', multiple: '', hidden: '' } });
  const photoNote = el('span', { class: 'muted small', text: 'Chưa chọn ảnh: dùng ảnh mẫu.' });
  photoInput.addEventListener('change', () => {
    photos.forEach((u) => URL.revokeObjectURL(u));
    photos = [...photoInput.files].slice(0, DEMO_LIMITS.photos).map((f) => URL.createObjectURL(f));
    photoNote.textContent = photos.length ? `Đã chọn ${photos.length} ảnh (chỉ hiện trên máy bạn, không tải lên).` : 'Chưa chọn ảnh: dùng ảnh mẫu.';
  });
  const usesPhotos = info.id === 'thien-ha' || info.id === 'tim-anh';

  const play = async () => {
    const name = v.name.trim() || 'Người ấy';
    const lines = v.lines.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 5);
    const mod = await import(`../fx/${info.id}.js`);
    await mod.play({
      name,
      sender: v.sender.trim() || 'Ai đó',
      phrase: v.phrase.trim().replaceAll('{ten}', name) || defaultPhrase(name),
      lines,
      imageUrls: photos.length ? photos : demoPhotos(),
      preview: true,
    });
    done.hidden = false;
    done.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const card = templateForEffect(info.id);
  const done = el('div', { class: 'fx-demo-done', attrs: { hidden: '' } }, [
    el('p', { text: 'Ưng chưa? Tạo thiệp thật để gửi người ấy, tên và câu bạn vừa nhập được điền sẵn 💖' }),
    card ? el('a', { class: 'btn btn-primary btn-lg', text: '💌 Tạo thiệp này', attrs: { href: `/tao?mau=${card.id}&tu=xem-thu` } }) : null,
    el('button', { class: 'btn btn-ghost', text: '↻ Xem lại hiệu ứng', attrs: { type: 'button' }, on: { click: () => ((done.hidden = true), play()) } }),
  ]);

  root.replaceChildren(
    el('main', { class: 'page-main fx-demo' }, [
      el('div', { class: 'fx-demo-head' }, [
        el('div', { class: 'empty-emoji', text: info.emoji }),
        el('h1', { text: info.name }),
        el('p', { class: 'muted', text: info.desc }),
      ]),
      el('form', { class: 'panel fx-demo-form', on: { submit: (e) => (e.preventDefault(), play()) } }, [
        el('p', { class: 'small', text: '✏️ Điền thử tên của hai bạn rồi bấm xem nhé:' }),
        field('Tên người nhận', 'name', { max: DEMO_LIMITS.name, placeholder: 'Ví dụ: Người ấy, Ẻm, Bé Mây…' }),
        field('Tên của bạn', 'sender', { max: DEMO_LIMITS.name, placeholder: 'Ví dụ: Tớ' }),
        field('Câu yêu thương (để trống = "Thương {tên} nhiều lắm")', 'phrase', { max: DEMO_LIMITS.phrase, placeholder: 'Ví dụ: Anh yêu em' }),
        info.id === 'thien-ha' ? field('Vài câu ngắn bay quanh vũ trụ (mỗi dòng một câu)', 'lines', { max: DEMO_LIMITS.lines, multiline: true }) : null,
        usesPhotos
          ? el('div', { class: 'field' }, [
              el('span', { class: 'field-label', text: `Ảnh của hai bạn (tối đa ${DEMO_LIMITS.photos})` }),
              el('div', { class: 'share-actions' }, [
                el('button', { class: 'btn btn-soft btn-sm', text: '🖼️ Chọn ảnh', attrs: { type: 'button' }, on: { click: () => photoInput.click() } }),
                photoNote,
              ]),
              photoInput,
            ])
          : null,
        el('button', { class: 'btn btn-primary btn-lg', text: 'Xem hiệu ứng ✨', attrs: { type: 'submit' } }),
      ]),
      done,
    ]),
  );
}

async function start() {
  const effect = FINALES.find((f) => f.id && f.id === params.get('hieu-ung'));
  if (effect) return showEffect(effect);

  const demoId = params.get('demo');
  if (demoId && TEMPLATES[demoId]?.ready) {
    const base = defaultCardData(demoId);
    // Bản mẫu dùng tên chung chung, không dùng tên người thật.
    const data = withFallbacks(demoId, { ...base, recipientName: 'Người ấy', senderName: 'Tớ', texts: { ...base.texts, ...demoTexts(demoId) } });
    const pickId = (list, key) => (list.some((x) => x.id === params.get(key)) ? params.get(key) : undefined);
    data.fx = {
      ...data.fx,
      ...(pickId(FINALES, 'fx') !== undefined && { finale: pickId(FINALES, 'fx') }),
      ...(pickId(OPENINGS, 'mo') !== undefined && { opening: pickId(OPENINGS, 'mo') }),
      ...(pickId(BACKGROUNDS, 'nen') !== undefined && { bg: pickId(BACKGROUNDS, 'nen') }),
    };
    if (pickId(GAMES, 'choi')) data.game = { ...defaultGame(), id: pickId(GAMES, 'choi') };
    data.stickers = ['iu', 'thuong'];
    return mountCard(root, { template: demoId, data, imageUrls: [] }, { preview: true, backHref: '/#mau-thiep', backText: '← Mẫu khác', useHref: `/tao?mau=${demoId}` });
  }

  const templateId = params.get('mau') || lastTemplate();
  if (!templateId || !TEMPLATES[templateId]?.ready) return showMissing();
  const draft = await loadDraft(templateId);
  if (!draft) return showMissing();

  const imageUrls = draft.images.map((img) => URL.createObjectURL(imageToBlob(img)));
  const musicUrl = draft.music ? URL.createObjectURL(imageToBlob(draft.music)) : null;
  const voiceUrl = draft.voice ? URL.createObjectURL(imageToBlob(draft.voice)) : null;
  const data = withFallbacks(templateId, draft.data);
  const open = () =>
    mountCard(root, { template: templateId, data, imageUrls, musicUrl, voiceUrl }, { preview: true, backHref: `/tao?mau=${encodeURIComponent(templateId)}` });
  const waitUntil = openAtMs(data.openAt);
  if (waitUntil && waitUntil > Date.now()) {
    return showCountdown(root, {
      template: templateId,
      name: data.recipientName,
      sender: data.senderName,
      openAt: data.openAt,
      font: data.font,
      waitUntil,
      preview: true,
      onDone: open,
    });
  }
  await open();
}

start();
