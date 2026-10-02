// Trang /tao?mau=<id> — trình tạo 3 bước, tự lưu nháp vào IndexedDB.
import { createCard } from '../core/api.js';
import { el, fillName, qs, toast } from '../core/dom.js';
import { imageToBlob, loadDraft, rememberLastTemplate, saveDraft } from '../core/draft-store.js';
import { textField } from '../core/form.js';
import { compressImage } from '../core/image-compress.js';
import { encodeOrderHash, saveOrderInfo } from '../core/order-store.js';
import { CUSTOM_MUSIC_ID, MUSIC_MAX_BYTES, detectAudioMime } from '../shared/audio.js';
import { COMBO_CARD_PLAN, PLANS, PREVIEW_MAX_IMAGES, formatVnd, premiumUsed } from '../shared/plans.js';
import { LOCK_LIMITS, hashAnswer } from '../shared/lock.js';
import { BACKGROUNDS, OPENINGS, PRESETS, defaultFx, matchPreset, presetFx } from '../shared/effects.js';
import { GAMES, GAME_LIMITS, defaultGame } from '../shared/games.js';
import { COMMON_FIELDS, MUSIC, RELATIONSHIPS, RELATIONSHIP_LABEL_MAX, TEMPLATES, defaultCardData, relationshipsOf, textDefault, templateForEffect } from '../shared/templates.js';
import { CUSTOM_PRONOUN_MAX, PRONOUNS, fillPronouns, isCustomPronoun, pickPronoun, pronounOptions } from '../shared/pronouns.js';
import { FONTS, defaultFont, fontStack } from '../shared/fonts.js';
import { loadAllFonts } from '../core/fonts.js';
import { voiceRecorder } from '../card/voice.js';
import { formatOpenAt, openAtMs, toOpenAt } from '../shared/schedule.js';

const templateId = new URLSearchParams(location.search).get('mau');
const tpl = TEMPLATES[templateId];
const app = qs('#app');

let draft;
let saveTimer;
let saveWarned = false;
const imageUrls = new Map(); // id ảnh -> blob URL để hiện ảnh thu nhỏ

// ---------- Lưu nháp ----------

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 400);
}

async function saveNow() {
  clearTimeout(saveTimer);
  try {
    await saveDraft(draft);
  } catch {
    if (!saveWarned) toast('Trình duyệt này không lưu được bản nháp, bạn làm xong trong một lần nhé.');
    saveWarned = true;
  }
}

// ---------- Ô nhập liệu ----------

function chips(options, selected, onPick) {
  const group = el('div', { class: 'chips', attrs: { role: 'radiogroup' } });
  for (const [value, label] of options) {
    const chip = el('button', {
      class: 'chip' + (value === selected ? ' selected' : ''),
      text: label,
      attrs: { type: 'button', role: 'radio', 'aria-checked': String(value === selected) },
      on: {
        click: () => {
          for (const c of group.children) {
            c.classList.remove('selected');
            c.setAttribute('aria-checked', 'false');
          }
          chip.classList.add('selected');
          chip.setAttribute('aria-checked', 'true');
          onPick(value);
        },
      },
    });
    group.append(chip);
  }
  return group;
}

// ---------- Bước 1: người nhận ----------

/**
 * Đổi mối quan hệ / cách xưng hô: ô nào người dùng chưa sửa (còn đúng chữ mặc định cũ)
 * thì đổi sang chữ mặc định mới, rồi vẽ lại bước 2.
 */
function retext(before, after) {
  const d = draft.data;
  let changed = false;
  for (const key of Object.keys(tpl.texts)) {
    const oldDefault = textDefault(templateId, key, before.relationship, before.pronoun);
    const newDefault = textDefault(templateId, key, after.relationship, after.pronoun);
    if (d.texts[key] === oldDefault && oldDefault !== newDefault) {
      d.texts[key] = newDefault;
      changed = true;
    }
  }
  d.relationship = after.relationship;
  d.pronoun = after.pronoun;
  if (changed) {
    const fresh = stepMessage();
    fresh.hidden = stepEls[1].hidden;
    stepEls[1].replaceWith(fresh);
    stepEls[1] = fresh;
  }
  scheduleSave();
}

/** Ô chữ nhỏ dùng ở bước 1 (tự nhập mối quan hệ / xưng hô). */
function smallInput(value, { max, placeholder, label }, onInput) {
  const input = el('input', { class: 'input', attrs: { type: 'text', maxlength: String(max), placeholder, 'aria-label': label } });
  input.value = value || '';
  input.addEventListener('input', () => onInput(input.value));
  return input;
}

/** Lựa chọn cách xưng hô, luôn có thêm "✏️ Tự nhập" (ví dụ cháu – bà, con – ba, mình – cậu). */
function pronounField() {
  const d = draft.data;
  const wrap = el('div', { class: 'field' });
  const change = (pronoun) => retext({ relationship: d.relationship, pronoun: d.pronoun }, { relationship: d.relationship, pronoun });
  let customOpen = isCustomPronoun(d.pronoun);
  const render = () => {
    const options = pronounOptions(tpl, d.relationship);
    draft.customPronoun ??= isCustomPronoun(d.pronoun) ? { ...d.pronoun } : { toi: '', ban: '' };
    const cp = draft.customPronoun;
    const sample = el('p', { class: 'muted small custom-sample' });
    const showSample = () => {
      const p = pickPronoun(tpl, d.relationship, cp);
      sample.textContent = isCustomPronoun(p)
        ? `Ví dụ: “${fillPronouns('{Toi} thương {ban} nhiều lắm', p)}”`
        : 'Gõ cả hai ô, ví dụ: cháu – bà, con – ba, mình – cậu.';
    };
    const onCustom = () => {
      const p = pickPronoun(tpl, d.relationship, cp);
      if (isCustomPronoun(p)) change(p);
      scheduleSave();
      showSample();
    };
    showSample();
    wrap.replaceChildren(
      el('span', { class: 'field-label', text: 'Hai bạn xưng hô thế nào?' }),
      chips(
        [
          ...options.map((id) => [id, PRONOUNS[id].hint ? `${PRONOUNS[id].label} (${PRONOUNS[id].hint})` : PRONOUNS[id].label]),
          ['tu-nhap', '✏️ Tự nhập'],
        ],
        customOpen ? 'tu-nhap' : d.pronoun,
        (v) => {
          customOpen = v === 'tu-nhap';
          if (customOpen) onCustom();
          else change(v);
          render();
        },
      ),
      customOpen
        ? el('div', { class: 'custom-box' }, [
            el('div', { class: 'custom-pair' }, [
              el('label', { class: 'small' }, [
                el('span', { text: 'Bạn tự xưng là' }),
                smallInput(cp.toi, { max: CUSTOM_PRONOUN_MAX, placeholder: 'cháu', label: 'Bạn tự xưng là' }, (v) => ((cp.toi = v), onCustom())),
              ]),
              el('label', { class: 'small' }, [
                el('span', { text: 'Gọi người ấy là' }),
                smallInput(cp.ban, { max: CUSTOM_PRONOUN_MAX, placeholder: 'bà', label: 'Gọi người ấy là' }, (v) => ((cp.ban = v), onCustom())),
              ]),
            ]),
            sample,
          ])
        : '',
    );
  };
  render();
  wrap.rerender = render;
  return wrap;
}

function stepRecipient() {
  const d = draft.data;
  d.pronoun = pickPronoun(tpl, d.relationship, d.pronoun);
  const pronouns = pronounField();
  // "Khác": người dùng tự gõ mối quan hệ (bà ngoại, anh trai, sếp…).
  const relInput = smallInput(d.relationshipLabel, { max: RELATIONSHIP_LABEL_MAX, placeholder: 'Ví dụ: Bà ngoại, Anh trai, Sếp…', label: 'Người ấy là gì của bạn' }, (v) => {
    d.relationshipLabel = v;
    scheduleSave();
  });
  const relBox = el('div', { class: 'custom-box' }, [relInput]);
  relBox.hidden = d.relationship !== 'khac';
  return el('section', { class: 'step' }, [
    el('h2', { text: 'Gửi cho ai?' }),
    textField(COMMON_FIELDS.recipientName, d.recipientName, (v) => {
      d.recipientName = v;
      scheduleSave();
    }).wrap,
    el('div', { class: 'field' }, [
      el('span', { class: 'field-label', text: 'Người ấy là gì của bạn?' }),
      chips(
        relationshipsOf(tpl).map((r) => [r, r === 'khac' ? '✏️ Khác' : RELATIONSHIPS[r]]),
        d.relationship,
        (v) => {
          relBox.hidden = v !== 'khac';
          if (v === 'khac') setTimeout(() => relInput.focus(), 0);
          // Giữ cách xưng hô nếu mối quan hệ mới cũng có, không thì lấy cách mặc định của nó.
          retext({ relationship: d.relationship, pronoun: d.pronoun }, { relationship: v, pronoun: pickPronoun(tpl, v, d.pronoun) });
          pronouns.rerender();
        },
      ),
      relBox,
    ]),
    pronouns,
    textField(COMMON_FIELDS.senderName, d.senderName, (v) => {
      d.senderName = v;
      scheduleSave();
    }).wrap,
    lockSection(),
  ]);
}

/**
 * Khóa thiệp bằng câu hỏi bí mật (không bắt buộc). Đáp án gốc chỉ nằm trong bản nháp trên máy;
 * thứ gửi lên server là bản băm của đáp án.
 */
function lockSection() {
  draft.lockForm ??= { on: false, question: '', answer: '', hint: '' };
  const f = draft.lockForm;
  const update = async () => {
    draft.data.lock = f.on && f.question.trim() && f.answer.trim()
      ? { question: f.question.trim(), hint: f.hint.trim(), answerHash: await hashAnswer(f.answer) }
      : null;
    scheduleSave();
  };
  const field = (def, key) => textField(def, f[key], (v) => ((f[key] = v), update())).wrap;
  const fields = el('div', { class: 'lock-fields' }, [
    field({ label: 'Câu hỏi bí mật', max: LOCK_LIMITS.question, placeholder: 'Ví dụ: Mình gặp nhau lần đầu ở đâu?' }, 'question'),
    field({ label: 'Đáp án (không phân biệt dấu, hoa thường)', max: LOCK_LIMITS.answer, placeholder: 'Ví dụ: Đà Lạt' }, 'answer'),
    field({ label: 'Gợi ý khi trả lời sai 3 lần (không bắt buộc)', max: LOCK_LIMITS.hint, placeholder: 'Ví dụ: Thành phố sương mù' }, 'hint'),
  ]);
  fields.hidden = !f.on;
  const toggle = el('input', { attrs: { type: 'checkbox' } });
  toggle.checked = f.on;
  toggle.addEventListener('change', () => {
    f.on = toggle.checked;
    fields.hidden = !f.on;
    update();
  });
  return el('div', { class: 'lock-box' }, [
    el('label', { class: 'lock-toggle' }, [
      toggle,
      el('span', {}, [el('strong', { text: '🔐 Khóa thiệp bằng câu hỏi bí mật' }), el('span', { class: 'muted small', text: ' · chỉ đúng người mới mở được, kèm màn phá dấu niêm phong' })]),
    ]),
    fields,
  ]);
}

// ---------- Bước 2: lời nhắn + ảnh ----------

let wishesPromise;
async function suggestWishes() {
  wishesPromise ??= fetch('/data/loi-chuc.json').then((r) => r.json());
  const all = await wishesPromise;
  const group = all[templateId] || {};
  // Vợ/chồng/crush chưa có nhóm riêng thì mượn lời chúc của người yêu (đã viết theo chỗ trống xưng hô).
  const rel = draft.data.relationship;
  const pool = group[rel] || (['vo', 'chong', 'crush'].includes(rel) && group['nguoi-yeu']) || Object.values(group).flat();
  return [...pool]
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map((w) => fillName(fillPronouns(w, draft.data.pronoun), draft.data.recipientName.trim()));
}

/**
 * Ô chữ hiện sẵn ở bước 2; các ô còn lại đã có câu mặc định hay nên gấp vào "Sửa thêm câu chữ khác".
 * Mẫu không có trong danh sách: hiện ô có gợi ý lời nhắn (hoặc 2 ô đầu).
 */
const MAIN_TEXTS = {
  'to-tinh': ['question', 'message'],
  'phu-nu-2010': ['message'],
  'xin-loi': ['question', 'message'],
  'o-canh-em': ['loveStart', 'message'],
  'chuyen-tinh': ['loveStart', 'moments', 'message'],
  'so-tay': ['loveStart', 'firstPage'],
  'ca-nhom': ['groupName', 'message'],
  'mo-khi': ['intro', 'l1Title', 'l1Body', 'l2Title', 'l2Body', 'l3Title', 'l3Body'],
  'sinh-nhat': ['age', 'message'],
  'di-choi': ['question', 'message'],
  'vu-tru': ['phrase', 'message'],
  'tim-sang': ['phrase', 'message'],
  'ten-sao': ['phrase', 'message'],
  'tim-anh': ['phrase', 'message'],
};
function mainTexts() {
  if (MAIN_TEXTS[templateId]) return MAIN_TEXTS[templateId];
  const keys = Object.keys(tpl.texts);
  const suggest = keys.filter((k) => tpl.texts[k].suggest);
  return suggest.length ? suggest : keys.slice(0, 2);
}

function stepMessage() {
  const d = draft.data;
  const section = el('section', { class: 'step' }, [el('h2', { text: 'Viết lời nhắn' })]);
  const main = mainTexts();
  const extra = el('details', { class: 'more-texts' }, [el('summary', { text: '✏️ Sửa thêm câu chữ khác (đã có sẵn câu hay, không bắt buộc)' })]);

  for (const [key, def] of Object.entries(tpl.texts)) {
    const host = main.includes(key) ? section : extra;
    const { wrap, input } = textField(def, d.texts[key], (v) => {
      d.texts[key] = v;
      scheduleSave();
    });
    host.append(wrap);
    if (def.suggest) {
      const list = el('div', { class: 'suggestions' });
      const btn = el('button', {
        class: 'btn btn-soft btn-sm',
        text: '💡 Gợi ý lời nhắn',
        attrs: { type: 'button' },
        on: {
          click: async () => {
            try {
              const wishes = await suggestWishes();
              list.replaceChildren(
                ...wishes.map((w) =>
                  el('button', {
                    class: 'suggestion',
                    text: w,
                    attrs: { type: 'button' },
                    on: {
                      click: () => {
                        input.value = w;
                        input.dispatchEvent(new Event('input'));
                        list.replaceChildren();
                        toast('Đã chèn lời nhắn, bạn sửa thêm cho đúng ý nhé');
                      },
                    },
                  }),
                ),
              );
            } catch {
              toast('Chưa tải được gợi ý, bạn thử lại nhé.');
            }
          },
        },
      });
      host.append(btn, list);
    }
  }

  section.append(fontPicker(), voiceField());
  if (extra.children.length > 1) section.append(extra);
  section.append(el('h2', { text: 'Thêm ảnh kỷ niệm' }), photoPicker());
  return section;
}

/** Lời nhắn bằng giọng nói (không bắt buộc): ghi ngay trên điện thoại, lưu trong bản nháp. */
function voiceField() {
  return el('div', { class: 'field voice-field' }, [
    el('span', { class: 'field-label' }, [el('span', { text: '🎙️ Lời nhắn bằng giọng nói (không bắt buộc) ' }), premiumTag()]),
    voiceRecorder(draft.voice || null, async (value) => {
      draft.voice = value;
      await saveNow();
    }),
  ]);
}

let refreshFontSamples = () => {};
/** Chọn kiểu chữ: mỗi ô viết sẵn tên người nhận bằng đúng kiểu đó, chạm là chọn. */
function fontPicker() {
  const d = draft.data;
  d.font ||= defaultFont(templateId);
  loadAllFonts();
  const suggested = defaultFont(templateId);
  const name = () => (d.recipientName.trim() || 'Người ấy') + ' ơi,';
  const list = el('div', { class: 'font-list', attrs: { role: 'radiogroup', 'aria-label': 'Kiểu chữ' } });
  const render = () =>
    list.replaceChildren(
      ...FONTS.map((f) => {
        const sample = el('span', { class: 'font-sample', text: name() });
        sample.style.fontFamily = fontStack(f.id);
        return el('button', {
          class: 'font-option' + (d.font === f.id ? ' selected' : ''),
          attrs: { type: 'button', role: 'radio', 'aria-checked': String(d.font === f.id) },
          on: {
            click: () => {
              d.font = f.id;
              scheduleSave();
              render();
            },
          },
        }, [
          sample,
          el('span', { class: 'font-name', text: f.name + (f.id === suggested ? ' ✨' : '') }),
          el('span', { class: 'font-hint', text: f.hint }),
        ]);
      }),
    );
  render();
  refreshFontSamples = render; // tên người nhận đổi ở bước 1 → vẽ lại khi sang bước 2
  return el('div', { class: 'field font-field' }, [
    el('span', { class: 'field-label', text: '🖋️ Kiểu chữ cho lời nhắn (✨ = hợp với mẫu này)' }),
    list,
  ]);
}

function photoPicker() {
  const grid = el('div', { class: 'photo-grid' });
  const status = el('p', { class: 'muted small', attrs: { 'aria-live': 'polite' } });
  const fileInput = el('input', { attrs: { type: 'file', accept: 'image/*', multiple: '', hidden: '' } });

  const renderGrid = () => {
    grid.replaceChildren(
      ...draft.images.map((img, i) => {
        if (!imageUrls.has(img.id)) imageUrls.set(img.id, URL.createObjectURL(imageToBlob(img)));
        return el('div', { class: 'photo' }, [
          el('img', { attrs: { src: imageUrls.get(img.id), alt: `Ảnh ${i + 1}` } }),
          el('button', {
            class: 'photo-remove',
            text: '×',
            attrs: { type: 'button', 'aria-label': `Xoá ảnh ${i + 1}` },
            on: {
              click: () => {
                URL.revokeObjectURL(imageUrls.get(img.id));
                imageUrls.delete(img.id);
                draft.images.splice(i, 1);
                saveNow();
                renderGrid();
              },
            },
          }),
        ]);
      }),
    );
    if (draft.images.length < PREVIEW_MAX_IMAGES) {
      grid.append(el('button', { class: 'photo add', text: '＋', attrs: { type: 'button', 'aria-label': 'Thêm ảnh' }, on: { click: () => fileInput.click() } }));
    }
    status.textContent = `${draft.images.length}/${PREVIEW_MAX_IMAGES} ảnh · Gói Cơ bản dùng tối đa ${PLANS['co-ban'].maxImages} ảnh, gói Đặc biệt ${PLANS['dac-biet'].maxImages} ảnh.`;
  };

  fileInput.addEventListener('change', async () => {
    const files = [...fileInput.files].slice(0, PREVIEW_MAX_IMAGES - draft.images.length);
    fileInput.value = '';
    for (const [n, file] of files.entries()) {
      status.textContent = `Đang xử lý ảnh ${n + 1}/${files.length}…`;
      try {
        const blob = await compressImage(file);
        draft.images.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, type: blob.type, buf: await blob.arrayBuffer() });
      } catch (e) {
        toast(e.message);
      }
    }
    await saveNow();
    renderGrid();
  });

  renderGrid();
  return el('div', {}, [grid, status, fileInput]);
}

// ---------- Bước 3: nhạc ----------

function stepMusic() {
  const d = draft.data;
  const audio = new Audio();
  let playing = null;
  let customUrl = null;
  const list = el('div', { class: 'music-list', attrs: { role: 'radiogroup' } });

  const stopAll = () => {
    audio.pause();
    playing = null;
    for (const b of list.querySelectorAll('.music-item .btn')) b.textContent = '▶ Nghe thử';
  };
  const playButton = (id, getSrc) =>
    el('button', {
      class: 'btn btn-soft btn-sm',
      text: '▶ Nghe thử',
      attrs: { type: 'button' },
      on: {
        click: (e) => {
          const btn = e.currentTarget;
          const wasPlaying = playing === id;
          stopAll();
          if (wasPlaying) return;
          audio.src = getSrc();
          audio.play().catch(() => toast('Chưa phát được bản nhạc này.'));
          playing = id;
          btn.textContent = '⏸ Dừng';
        },
      },
    });

  const radios = [];
  const choose = (id) => {
    d.music = id;
    for (const r of radios) r.checked = r.value === id;
    scheduleSave();
  };

  for (const m of MUSIC) {
    const radio = el('input', { attrs: { type: 'radio', name: 'music', value: m.id } });
    radio.checked = d.music === m.id;
    radio.addEventListener('change', () => choose(m.id));
    radios.push(radio);
    const play = m.id === 'none' ? null : playButton(m.id, () => `/music/${m.id}.mp3`);
    list.append(el('label', { class: 'music-item' }, [radio, el('span', { text: m.name }), play]));
  }

  // --- Nhạc của bạn: tải file từ máy, lưu trong bản nháp, chỉ gửi lên server khi lấy link.
  const fileInput = el('input', { attrs: { type: 'file', accept: 'audio/*,.mp3,.m4a,.aac,.ogg', hidden: '' } });
  const customRadio = el('input', { attrs: { type: 'radio', name: 'music', value: CUSTOM_MUSIC_ID } });
  radios.push(customRadio);
  const customName = el('span');
  const customActions = el('div', { class: 'music-custom-actions' });
  const customItem = el('label', { class: 'music-item music-custom' }, [customRadio, customName, customActions]);
  list.append(customItem);

  const renderCustom = () => {
    const m = draft.music;
    customRadio.checked = d.music === CUSTOM_MUSIC_ID && !!m;
    customRadio.disabled = !m;
    customName.textContent = m ? `🎵 ${m.name} · 💎 Đặc biệt` : '🎵 Nhạc của bạn (MP3, M4A · tối đa 4MB) · 💎 Gói Đặc biệt';
    if (customUrl) URL.revokeObjectURL(customUrl);
    customUrl = m ? URL.createObjectURL(imageToBlob(m)) : null;
    const pick = el('button', {
      class: 'btn btn-soft btn-sm',
      text: m ? 'Đổi bài' : '⬆ Tải lên',
      attrs: { type: 'button' },
      on: { click: (e) => (e.preventDefault(), fileInput.click()) },
    });
    customActions.replaceChildren(...(m ? [playButton(CUSTOM_MUSIC_ID, () => customUrl), pick] : [pick]));
  };

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    if (file.size > MUSIC_MAX_BYTES) {
      toast(`Bài này nặng ${(file.size / 1024 / 1024).toFixed(1)}MB, tối đa 4MB. Bạn cắt ngắn đoạn điệp khúc hoặc chọn bản nhẹ hơn nhé.`, 5000);
      return;
    }
    const buf = await file.arrayBuffer();
    const type = detectAudioMime(new Uint8Array(buf.slice(0, 16)));
    if (!type) {
      toast('File này không phải nhạc MP3, M4A hoặc OGG.', 4000);
      return;
    }
    stopAll();
    draft.music = { name: file.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'Nhạc của bạn', type, buf };
    renderCustom();
    choose(CUSTOM_MUSIC_ID);
    await saveNow();
    toast('Đã thêm nhạc của bạn 🎶');
  });
  customRadio.addEventListener('change', () => choose(CUSTOM_MUSIC_ID));
  renderCustom();

  return el('section', { class: 'step' }, [
    el('h2', { text: 'Chọn nhạc nền' }),
    el('p', { class: 'muted small', text: 'Nhạc sẽ phát khi người nhận chạm mở thiệp, họ có thể tắt bất cứ lúc nào.' }),
    list,
    fileInput,
    el('p', {
      class: 'muted small',
      text: 'Nhạc tự tải lên: chỉ dùng bài bạn có quyền sử dụng. Bài nhạc chỉ phát trong thiệp, người nhận không tải về được.',
    }),
    effectsSection(),
    specialOptions(),
  ]);
}

// ---------- Bước 3 (tiếp): tuỳ chọn đặc biệt (hẹn giờ, mở cùng nhau, quay phản ứng) ----------

/** Một dòng bật/tắt có giải thích ngắn; bật thì hiện thêm phần chi tiết (nếu có). */
/** Nhãn nhỏ "💎 Gói Đặc biệt" cạnh tính năng cao cấp. */
const premiumTag = () => el('span', { class: 'premium-tag', text: '💎 Gói Đặc biệt' });

function toggleRow({ icon, title, desc, checked, onChange, detail = null, premium = false }) {
  const box = el('input', { attrs: { type: 'checkbox' } });
  box.checked = checked;
  if (detail) detail.hidden = !checked;
  box.addEventListener('change', () => {
    if (detail) detail.hidden = !box.checked;
    onChange(box.checked);
  });
  return el('div', { class: 'opt-row' + (checked ? ' on' : '') }, [
    el('label', { class: 'opt-toggle' }, [
      box,
      el('span', { class: 'opt-icon', text: icon, attrs: { 'aria-hidden': 'true' } }),
      el('span', { class: 'opt-text' }, [el('strong', { text: title }), premium ? premiumTag() : '', el('span', { class: 'muted small', text: desc })]),
    ]),
    detail,
  ]);
}

function specialOptions() {
  const d = draft.data;
  const save = () => scheduleSave();

  // ⏰ Hẹn giờ mở
  const when = el('input', { class: 'input', attrs: { type: 'datetime-local', min: toOpenAt(Date.now()).slice(0, 16) } });
  when.value = d.openAt || '';
  const whenNote = el('p', { class: 'muted small' });
  const setWhen = (v) => {
    d.openAt = v;
    when.value = v;
    const ms = openAtMs(v);
    const tooFar = ms && ms - Date.now() > PLANS['co-ban'].days * 24 * 60 * 60 * 1000;
    whenNote.textContent = !v
      ? 'Chọn ngày giờ ở trên nhé.'
      : ms && ms < Date.now()
        ? '⚠️ Giờ này đã qua, thiệp sẽ mở ngay.'
        : `Thiệp sẽ mở lúc ${formatOpenAt(v)} (giờ Việt Nam).${tooFar ? ` Lưu ý: xa hơn ${PLANS['co-ban'].days} ngày thì chọn gói Đặc biệt, gói Cơ bản hết hạn trước giờ mở.` : ''}`;
    save();
  };
  when.addEventListener('change', () => setWhen(when.value));
  const quick = (label, ms) => el('button', { class: 'chip', text: label, attrs: { type: 'button' }, on: { click: () => setWhen(toOpenAt(ms)) } });
  const midnight = (days) => {
    const t = new Date();
    t.setHours(24 * days, 0, 0, 0);
    return t.getTime();
  };
  const next2010 = (() => {
    const y = new Date().getFullYear();
    const at = openAtMs(`${y}-10-20T00:00`);
    return at > Date.now() ? at : openAtMs(`${y + 1}-10-20T00:00`);
  })();
  const scheduleDetail = el('div', { class: 'opt-detail' }, [
    el('div', { class: 'chips' }, [quick('0 giờ đêm nay', midnight(1)), quick('0 giờ ngày 20/10', next2010)]),
    when,
    whenNote,
  ]);
  if (d.openAt) setWhen(d.openAt);

  const rows = [
    toggleRow({
      icon: '⏰',
      title: 'Hẹn giờ mở thiệp',
      desc: 'Gửi link trước, tới đúng giờ (ví dụ 0 giờ sinh nhật) thiệp mới mở. Trước đó người nhận chỉ thấy đồng hồ đếm ngược.',
      checked: !!d.openAt,
      detail: scheduleDetail,
      onChange: (on) => (on ? setWhen(d.openAt || toOpenAt(midnight(1))) : ((d.openAt = ''), save())),
    }),
    toggleRow({
      icon: '💞',
      title: 'Mở cùng nhau (cho cặp đôi yêu xa)',
      desc: 'Thiệp chỉ mở khi cả hai cùng bấm "Sẵn sàng". Hai bạn gọi video rồi cùng xem một lúc. Bạn mở phía mình ở trang quản lý thiệp.',
      checked: !!d.together,
      premium: true,
      onChange: (on) => ((d.together = on), save()),
    }),
    toggleRow({
      icon: '📹',
      title: 'Xin quay phản ứng của người nhận',
      desc: 'Người nhận được hỏi có đồng ý quay 15 giây bằng camera trước không. Họ xem lại và tự quyết có gửi cho bạn hay không.',
      checked: !!d.reactionCam,
      premium: true,
      onChange: (on) => ((d.reactionCam = on), save()),
    }),
  ];
  const box = el('details', { class: 'fx-custom special-options' }, [el('summary', { text: '🎁 Tuỳ chọn đặc biệt (không bắt buộc)' }), ...rows]);
  box.open = !!(d.openAt || d.together || d.reactionCam);
  return box;
}

// ---------- Bước 3 (tiếp): hiệu ứng đặc biệt ----------

function effectsSection() {
  const fx = (draft.data.fx ??= defaultFx(templateId));
  draft.data.game ??= defaultGame();
  const host = el('div', { class: 'fx-section' });
  // Lựa chọn hiện tại không khớp gói nào (ví dụ vừa gắn màn kết từ trang xem thử) thì mở sẵn phần tuỳ chỉnh.
  let customOpen = !matchPreset(fx, draft.data.game.id, templateId);

  const group = (title, items, key) => {
    const list = el('div', { class: 'fx-options fx-tiles', attrs: { role: 'radiogroup', 'aria-label': title } });
    for (const it of items) {
      const radio = el('input', { attrs: { type: 'radio', name: `fx-${key}`, value: it.id } });
      radio.checked = fx[key] === it.id;
      radio.addEventListener('change', () => {
        fx[key] = it.id;
        if (it.needsPhoto && !draft.images.length) toast('Hiệu ứng này cần ít nhất 1 ảnh (ở bước 2). Chưa có ảnh thì thiệp dùng hộp quà thay thế.', 4500);
        scheduleSave();
        renderPresets();
      });
      list.append(fxTile(it, radio, key));
    }
    return el('div', { class: 'fx-group' }, [el('h3', { text: title }), list]);
  };

  // Gói gợi ý: bấm là áp dụng cả bộ; bên dưới hiện gói nào đang khớp.
  const presetGrid = el('div', { class: 'preset-grid', attrs: { role: 'radiogroup', 'aria-label': 'Gói hiệu ứng' } });
  const note = el('p', { class: 'preset-note small' });
  function renderPresets() {
    const current = matchPreset(fx, draft.data.game.id, templateId);
    presetGrid.replaceChildren(
      ...PRESETS.map((p) =>
        el('button', {
          class: 'preset-card' + (current?.id === p.id ? ' selected' : ''),
          attrs: { type: 'button', role: 'radio', 'aria-checked': String(current?.id === p.id) },
          on: { click: () => applyPreset(p) },
        }, [
          el('span', { class: 'preset-emoji', text: p.emoji, attrs: { 'aria-hidden': 'true' } }),
          el('strong', { text: p.name }),
          el('span', { class: 'muted small', text: p.id === 'goi-y' ? describe(presetFx(p, templateId)) : p.desc }),
        ]),
      ),
    );
    const g = GAMES.find((x) => x.id === draft.data.game.id && x.id);
    const op = OPENINGS.find((x) => x.id === fx.opening && x.id);
    const bg = BACKGROUNDS.find((x) => x.id === fx.bg && x.id);
    const where = [
      op && `👆 Lúc mở: ${op.name}`,
      bg && `✨ Nền: ${bg.name}`,
      g && `🎮 Cuối thiệp: ${g.name}`,
    ].filter(Boolean);
    note.textContent =
      (current ? `Đang dùng gói "${current.name}". ` : '✏️ Bạn đang tự tuỳ chỉnh. ') +
      (where.length ? where.join(' · ') : 'Thiệp giữ nguyên như mẫu gốc.') +
      (g ? ` (sửa ${g.id === 'vong-quay' ? 'danh sách quà' : 'câu hỏi'} trong "Tuỳ chỉnh" bên dưới)` : '');
  }
  function applyPreset(p) {
    const v = presetFx(p, templateId);
    Object.assign(fx, v.fx);
    draft.data.game.id = v.game;
    scheduleSave();
    render();
    toast(`${p.emoji} Đã chọn gói "${p.name}". Bấm "Xem trước" để thử nhé!`);
  }

  // Thiệp hiệu ứng: bản thân thiệp đã là hiệu ứng, chỉ cho thêm màn mở đầu và trò chơi.
  if (tpl.effect) {
    host.append(
      el('h2', { text: '✨ Thêm cho thiệp' }),
      el('p', { class: 'muted small', text: 'Không bắt buộc. Bấm "▶ Xem" để thử ngay, hoặc "Xem trước" để xem cả tấm thiệp.' }),
      group('Màn mở đầu (trước khi vào hiệu ứng)', OPENINGS, 'opening'),
      gameSection(() => {}),
    );
    return host;
  }

  function render() {
    const custom = el('details', { class: 'fx-custom' }, [
      el('summary', { text: '🎨 Tuỳ chỉnh từng hiệu ứng' }),
      group('Màn mở đầu', OPENINGS, 'opening'),
      group('Hiệu ứng nền', BACKGROUNDS, 'bg'),
      gameSection(renderPresets),
    ]);
    custom.open = customOpen;
    custom.addEventListener('toggle', () => (customOpen = custom.open));
    renderPresets();
    host.replaceChildren(
      el('h2', { text: '✨ Thêm hiệu ứng cho thiệp' }),
      el('p', { class: 'muted small', text: 'Chọn một gói là xong. Hiệu ứng hiện lúc mở thiệp, chạy nền suốt thiệp, trò chơi nằm ở cuối. Bấm "Xem trước" để thử nhé!' }),
      presetGrid,
      note,
      custom,
      el('p', { class: 'fx-big-link small' }, [
        el('span', { text: '🌌 Muốn hiệu ứng 3D toàn màn hình (vũ trụ, trái tim nghìn hạt sáng…)? ' }),
        el('a', { text: 'Xem các thiệp hiệu ứng →', attrs: { href: '/#mau-thiep' } }),
      ]),
    );
  }
  render();
  return host;
}

/** Một ô hiệu ứng: biểu tượng to, tên, mô tả ngắn và nút "▶ Xem" chạy thử ngay trên màn hình. */
function fxTile(it, radio, kind) {
  const tryBtn = it.id
    ? el('button', {
        class: 'fx-try-btn',
        text: '▶ Xem',
        attrs: { type: 'button', 'aria-label': `Xem thử ${it.name}` },
        on: {
          click: async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const btn = e.currentTarget;
            btn.disabled = true;
            try {
              await tryIt(kind, it.id);
            } catch {
              toast('Chưa chạy thử được, bạn bấm "Xem trước" nhé.');
            }
            btn.disabled = false;
          },
        },
      })
    : null;
  return el('label', { class: 'fx-tile' + (it.id ? '' : ' fx-tile-none') }, [
    radio,
    el('span', { class: 'fx-tile-emoji', text: it.emoji, attrs: { 'aria-hidden': 'true' } }),
    el('strong', { class: 'fx-tile-name', text: it.name }),
    el('span', { class: 'fx-tile-desc', text: it.desc }),
    tryBtn,
  ]);
}

/** Chạy thử một hiệu ứng với tên, lời nhắn, ảnh của bản nháp (tải code khi cần). */
async function tryIt(kind, id) {
  const { tryEffect } = await import('../card/fx-try.js');
  const urls = draft.images.map((img) => {
    if (!imageUrls.has(img.id)) imageUrls.set(img.id, URL.createObjectURL(imageToBlob(img)));
    return imageUrls.get(img.id);
  });
  await tryEffect(kind, id, { templateId, data: draft.data, imageUrls: urls });
}

/** Mô tả ngắn một bộ hiệu ứng, ví dụ "Trời sao · Vũ trụ của tụi mình". */
function describe({ fx, game }) {
  const name = (list, id) => list.find((x) => x.id === id && id)?.name;
  const parts = [name(OPENINGS, fx.opening), name(BACKGROUNDS, fx.bg), name(GAMES, game)].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Giữ nguyên thiệp gốc';
}

/** Trò chơi cuối thiệp: chọn loại, rồi sửa danh sách quà hoặc câu đố. */
function gameSection(onChange) {
  const game = (draft.data.game ??= defaultGame());
  game.prizes ??= defaultGame().prizes;
  game.quiz ??= defaultGame().quiz;
  const L = GAME_LIMITS;
  const editor = el('div', { class: 'game-editor' });

  const input = (value, max, placeholder, onInput) => {
    const i = el('input', { class: 'input', attrs: { type: 'text', maxlength: String(max), placeholder } });
    i.value = value;
    i.addEventListener('input', () => (onInput(i.value), scheduleSave()));
    return i;
  };
  const smallBtn = (text, onClick) => el('button', { class: 'btn btn-ghost btn-sm', text, attrs: { type: 'button' }, on: { click: () => (onClick(), scheduleSave(), render()) } });

  function render() {
    if (game.id === 'vong-quay') {
      editor.replaceChildren(
        el('p', { class: 'muted small', text: `Các phần quà trên vòng quay (${L.minPrizes}–${L.prizes} ô). Người nhận chỉ quay được 1 lần, bạn xem kết quả ở trang quản lý.` }),
        ...game.prizes.map((p, i) =>
          el('div', { class: 'game-row' }, [
            input(p, L.prize, `Quà ${i + 1}`, (v) => (game.prizes[i] = v)),
            game.prizes.length > L.minPrizes ? smallBtn('✕', () => game.prizes.splice(i, 1)) : null,
          ]),
        ),
        game.prizes.length < L.prizes ? smallBtn('+ Thêm quà', () => game.prizes.push('')) : '',
      );
    } else if (game.id === 'cau-do') {
      editor.replaceChildren(
        el('p', { class: 'muted small', text: 'Chấm vào ô tròn để chọn đáp án đúng. Bạn xem được người nhận chọn gì ở trang quản lý.' }),
        ...game.quiz.map((q, i) =>
          el('div', { class: 'game-q' }, [
            el('div', { class: 'game-row' }, [
              input(q.q, L.question, `Câu hỏi ${i + 1}`, (v) => (q.q = v)),
              game.quiz.length > 1 ? smallBtn('✕', () => game.quiz.splice(i, 1)) : null,
            ]),
            ...q.options.map((o, k) => {
              const radio = el('input', { attrs: { type: 'radio', name: `quiz-${i}`, 'aria-label': 'Đáp án đúng' } });
              radio.checked = q.answer === k;
              radio.addEventListener('change', () => ((q.answer = k), scheduleSave()));
              return el('div', { class: 'game-row game-option' }, [radio, input(o, L.option, `Đáp án ${k + 1}`, (v) => (q.options[k] = v))]);
            }),
            q.options.length < L.options ? smallBtn('+ Thêm đáp án', () => q.options.push('')) : null,
          ]),
        ),
        game.quiz.length < L.questions ? smallBtn('+ Thêm câu hỏi', () => game.quiz.push({ q: '', options: ['', ''], answer: 0 })) : '',
      );
    } else editor.replaceChildren();
  }

  const list = el('div', { class: 'fx-options fx-tiles', attrs: { role: 'radiogroup', 'aria-label': 'Trò chơi cuối thiệp' } });
  for (const g of GAMES) {
    const radio = el('input', { attrs: { type: 'radio', name: 'fx-game', value: g.id } });
    radio.checked = game.id === g.id;
    radio.addEventListener('change', () => ((game.id = g.id), scheduleSave(), render(), onChange?.()));
    list.append(fxTile(g, radio, 'game'));
  }
  render();
  return el('div', { class: 'fx-group' }, [el('h3', { text: '🎮 Trò chơi cho người nhận' }), list, editor]);
}

// ---------- Lấy link: chọn gói và gửi lên server ----------

function checkRequired() {
  for (const key of ['recipientName', 'senderName']) {
    if (!draft.data[key].trim()) {
      toast(`Bạn chưa điền "${COMMON_FIELDS[key].label}"`);
      goTo(1);
      return false;
    }
  }
  return true;
}

function modal(title, children) {
  const backdrop = el('div', { class: 'modal-backdrop' });
  const close = () => backdrop.remove();
  backdrop.addEventListener('click', (e) => e.target === backdrop && close());
  backdrop.append(el('div', { class: 'modal', attrs: { role: 'dialog', 'aria-label': title } }, [el('h2', { text: title }), ...children]));
  document.body.append(backdrop);
  return close;
}

function planDescription(plan) {
  if (plan.cards) {
    const saving = plan.cards * PLANS['dac-biet'].price - plan.price;
    return `${plan.cards} thiệp, mỗi thiệp đủ quyền gói Đặc biệt · Tiết kiệm ${formatVnd(saving)} · Thiệp này + ${plan.cards - 1} thiệp nữa dùng mã combo`;
  }
  return `Tối đa ${plan.maxImages} ảnh · Link dùng ${plan.days} ngày${plan.extras ? ' · Giọng nói, quay phản ứng, mở cùng nhau, nhạc riêng · Sửa lời sau khi gửi · Mã QR in kèm quà' : ''}`;
}

function openPlanPicker() {
  if (!checkRequired()) return;
  const n = draft.images.length;
  const used = premiumUsed({ ...draft.data, voice: !!draft.voice });
  const options = Object.values(PLANS).map((plan) => {
    const tooMany = n > plan.maxImages;
    const needsExtras = !plan.extras && used.length > 0;
    const btn = el('button', { class: 'plan-option' + (plan.id === 'dac-biet' ? ' recommended' : ''), attrs: { type: 'button' } }, [
      el('span', { class: 'plan-name', text: plan.name + (plan.id === 'dac-biet' ? ' ⭐ Đáng tiền nhất' : '') }),
      el('span', { class: 'plan-price', text: formatVnd(plan.price) }),
      el('span', { class: 'plan-desc', text: planDescription(plan) }),
      tooMany ? el('span', { class: 'plan-warn', text: `Bạn đang có ${n} ảnh, cần bớt còn ${plan.maxImages} ảnh để chọn gói này.` }) : null,
      needsExtras ? el('span', { class: 'plan-warn', text: `Thiệp đang dùng ${used.join(', ')} (chỉ có ở gói Đặc biệt).` }) : null,
    ]);
    btn.disabled = tooMany || needsExtras;
    btn.addEventListener('click', () => submit(plan.id, btn));
    return btn;
  });
  // Đã mua combo: nhập mã → thiệp có link ngay, không cần chuyển khoản.
  const comboInput = el('input', { class: 'input', attrs: { placeholder: 'ABCDE-FGH23', autocapitalize: 'characters', autocomplete: 'off', maxlength: '20' } });
  const comboMax = PLANS[COMBO_CARD_PLAN].maxImages;
  const comboBtn = el('button', { class: 'btn btn-primary', text: 'Dùng mã', attrs: { type: 'button' } });
  comboBtn.addEventListener('click', () => {
    if (!comboInput.value.trim()) return toast('Bạn dán mã combo vào ô trước nhé.');
    if (n > comboMax) return toast(`Bạn đang có ${n} ảnh, thiệp combo tối đa ${comboMax} ảnh.`);
    submit(COMBO_CARD_PLAN, comboBtn, comboInput.value);
  });
  const comboBox = el('div', { class: 'combo-redeem', attrs: { hidden: '' } }, [
    el('p', { class: 'small muted', text: 'Mã combo nằm ở trang thanh toán và trang quản lý của thiệp đã mua combo.' }),
    el('div', { class: 'combo-redeem-row' }, [comboInput, comboBtn]),
  ]);
  const comboToggle = el('button', {
    class: 'btn btn-ghost btn-sm combo-toggle',
    text: '🎟️ Đã có mã combo? Nhập mã',
    attrs: { type: 'button' },
    on: {
      click: () => {
        comboBox.hidden = false;
        comboToggle.remove();
        comboInput.focus();
      },
    },
  });
  const allButtons = [...options, comboBtn];
  const close = modal('Chọn gói', [el('div', { class: 'plan-options' }, options), comboToggle, comboBox]);

  async function submit(planId, btn, comboCode = null) {
    for (const o of allButtons) o.disabled = true;
    btn.classList.add('loading');
    try {
      await saveNow();
      const music = draft.data.music === CUSTOM_MUSIC_ID && draft.music ? imageToBlob(draft.music) : null;
      const voice = draft.voice ? imageToBlob(draft.voice) : null;
      const res = await createCard({ template: templateId, plan: planId, data: draft.data, images: draft.images.map(imageToBlob), music, voice, comboCode });
      const info = { slug: res.slug, editToken: res.editToken, template: templateId, recipientName: draft.data.recipientName };
      saveOrderInfo(res.orderCode, info);
      // Bản nháp được giữ tới khi thanh toán xong (trang thanh toán sẽ xoá), lỡ đơn hết hạn vẫn tạo lại được.
      location.href = `/thanh-toan/${res.orderCode}#${encodeOrderHash(info)}`;
    } catch (e) {
      toast(e.message, 4000);
      btn.classList.remove('loading');
      options.forEach((o, i) => (o.disabled = n > Object.values(PLANS)[i].maxImages));
      comboBtn.disabled = false;
    }
  }
}

// ---------- Điều hướng giữa các bước ----------

const STEP_NAMES = ['Người nhận', 'Lời nhắn & ảnh', 'Nhạc & hiệu ứng'];
let stepEls = [];
let stepTabs = [];
let nextBtn;

function goTo(step) {
  draft.step = step;
  if (step === 2) refreshFontSamples();
  stepEls.forEach((s, i) => (s.hidden = i !== step - 1));
  stepTabs.forEach((t, i) => {
    t.classList.toggle('current', i === step - 1);
    t.classList.toggle('done', i < step - 1);
  });
  nextBtn.textContent = step < 3 ? 'Tiếp tục →' : 'Lấy link thiệp 💌';
  window.scrollTo({ top: 0 });
  scheduleSave();
}

function render() {
  stepEls = [stepRecipient(), stepMessage(), stepMusic()];
  stepTabs = STEP_NAMES.map((name, i) =>
    el('button', { class: 'step-tab', attrs: { type: 'button' }, on: { click: () => goTo(i + 1) } }, [
      el('span', { class: 'step-num', text: String(i + 1) }),
      el('span', { text: name }),
    ]),
  );

  nextBtn = el('button', {
    class: 'btn btn-primary',
    attrs: { type: 'button' },
    on: {
      click: () => {
        if (draft.step === 1 && !checkRequired()) return;
        if (draft.step < 3) goTo(draft.step + 1);
        else openPlanPicker();
      },
    },
  });
  const previewBtn = el('button', {
    class: 'btn btn-ghost',
    text: '👀 Xem trước',
    attrs: { type: 'button' },
    on: {
      click: async () => {
        await saveNow();
        location.href = `/xem-truoc?mau=${encodeURIComponent(templateId)}`;
      },
    },
  });

  app.replaceChildren(
    el('header', { class: 'creator-header' }, [
      el('a', { class: 'back', text: '←', attrs: { href: '/', 'aria-label': 'Về trang chủ' } }),
      el('div', {}, [el('p', { class: 'muted small', text: 'Mẫu thiệp' }), el('h1', { text: `${tpl.emoji} ${tpl.name}` })]),
    ]),
    el('nav', { class: 'step-tabs' }, stepTabs),
    el('form', { class: 'creator-form', on: { submit: (e) => e.preventDefault() } }, stepEls),
    el('div', { class: 'action-bar' }, [previewBtn, nextBtn]),
  );
  goTo(draft.step || 1);
}

async function init() {
  if (!tpl || !tpl.ready) {
    location.replace('/#mau-thiep');
    return;
  }
  const defaults = defaultCardData(templateId);
  const saved = await loadDraft(templateId);
  draft = saved || { template: templateId, step: 1, data: defaults, images: [] };
  // Gộp với mặc định phòng khi mẫu có thêm ô mới sau này.
  draft.data = { ...defaults, ...draft.data, texts: { ...defaults.texts, ...draft.data.texts } };
  // Màn kết nay là mẫu "thiệp hiệu ứng" riêng: bản nháp cũ đã gắn màn kết thì bỏ đi.
  draft.data.fx = { ...defaultFx(templateId), ...draft.data.fx, finale: '' };
  if (tpl.effect) draft.data.fx.bg = '';
  rememberLastTemplate(templateId);
  const linked = applyDemoInputs();
  applyReplyNames();
  render();
  if (linked) {
    // Đã có tên (điền từ trang xem thử) thì sang bước lời nhắn & ảnh, chưa có thì điền tên trước.
    const hasName = !!draft.data.recipientName.trim();
    goTo(hasName ? 2 : 1);
    toast(hasName ? '✨ Đã điền sẵn tên bạn vừa nhập. Thêm ảnh, sửa lời nhắn rồi bấm "Xem trước" nhé!' : 'Điền tên người nhận trước nhé!', 4500);
    return;
  }
  if (saved && (saved.data.recipientName || saved.images.length)) toast('Đã mở lại bản nháp lần trước ✍️');
}

/**
 * Đến từ trang xem thử hiệu ứng (/tao?mau=vu-tru&tu=xem-thu): bản nháp còn trống thì điền luôn
 * tên, câu yêu thương, các câu nhỏ người dùng vừa nhập ở trang xem thử.
 */
function applyDemoInputs() {
  const params = new URLSearchParams(location.search);
  // Link cũ dạng ?ket=thien-ha (trước khi tách thiệp hiệu ứng) vẫn coi như đến từ trang xem thử.
  if (params.get('tu') !== 'xem-thu' && !params.has('ket')) return false;
  let typed = {};
  try {
    typed = JSON.parse(sessionStorage.getItem('xem-thu-hieu-ung') || '{}');
  } catch {
    typed = {};
  }
  const generic = (v) => !v || ['Người ấy', 'Tớ'].includes(v.trim());
  if (!draft.data.recipientName && !generic(typed.name)) draft.data.recipientName = typed.name.trim().slice(0, COMMON_FIELDS.recipientName.max);
  if (!draft.data.senderName && !generic(typed.sender)) draft.data.senderName = typed.sender.trim().slice(0, COMMON_FIELDS.senderName.max);
  const t = draft.data.texts;
  const untouched = (key) => t[key] === undefined || t[key] === textDefault(templateId, key, draft.data.relationship, draft.data.pronoun);
  if (tpl.texts.phrase && typed.phrase?.trim() && untouched('phrase')) t.phrase = typed.phrase.trim().slice(0, tpl.texts.phrase.max);
  if (tpl.texts.lines && typed.lines?.trim() && untouched('lines')) t.lines = typed.lines.trim().slice(0, tpl.texts.lines.max);
  // Bỏ ?tu=… khỏi địa chỉ để tải lại trang không điền đè lần nữa.
  params.delete('tu');
  params.delete('ket');
  history.replaceState(null, '', `${location.pathname}?${params}`);
  scheduleSave();
  return true;
}

/** Đến từ nút "Gửi lại một tấm cho …" ở cuối thiệp người khác gửi: điền sẵn tên (đổi vai). */
function applyReplyNames() {
  let reply = null;
  try {
    reply = JSON.parse(sessionStorage.getItem('gui-lai') || 'null');
    sessionStorage.removeItem('gui-lai');
  } catch {
    return;
  }
  if (!reply?.to) return;
  const d = draft.data;
  if (!d.recipientName.trim()) d.recipientName = String(reply.to).slice(0, COMMON_FIELDS.recipientName.max);
  if (!d.senderName.trim() && reply.from) d.senderName = String(reply.from).slice(0, COMMON_FIELDS.senderName.max);
  scheduleSave();
}

init();
