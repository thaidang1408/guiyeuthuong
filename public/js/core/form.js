// Ô nhập chữ có bộ đếm ký tự, dùng cho trình tạo và trang quản lý.
import { el } from './dom.js';

export function textField(def, value, onInput) {
  if (def.type === 'date') return dateField(def, value, onInput);
  const multiline = def.multiline;
  const input = el(multiline ? 'textarea' : 'input', {
    class: 'input',
    attrs: { maxlength: String(def.max), placeholder: def.placeholder || def.default || '', ...(multiline ? { rows: '6' } : { type: 'text' }) },
  });
  input.value = value ?? '';
  const counter = el('span', { class: 'counter' });
  const update = () => (counter.textContent = `${[...input.value].length}/${def.max}`);
  input.addEventListener('input', () => {
    update();
    onInput(input.value);
  });
  update();
  const wrap = el('label', { class: 'field' }, [
    el('span', { class: 'field-label' }, [el('span', { text: def.label }), counter]),
    input,
  ]);
  return { wrap, input };
}

/** Ô chọn ngày (YYYY-MM-DD). Có nút xoá vì ô ngày thường không bắt buộc. */
function dateField(def, value, onInput) {
  const input = el('input', { class: 'input', attrs: { type: 'date', min: '1950-01-01', max: '2099-12-31' } });
  input.value = value ?? '';
  const clear = el('button', { class: 'btn btn-ghost btn-sm', text: 'Xoá', attrs: { type: 'button' } });
  const sync = () => (clear.hidden = !input.value);
  input.addEventListener('change', () => {
    sync();
    onInput(input.value);
  });
  clear.addEventListener('click', () => {
    input.value = '';
    sync();
    onInput('');
  });
  sync();
  const wrap = el('div', { class: 'field' }, [
    el('span', { class: 'field-label' }, [el('span', { text: def.label })]),
    el('div', { class: 'date-row' }, [input, clear]),
    def.hint ? el('span', { class: 'muted small', text: def.hint }) : null,
  ]);
  return { wrap, input };
}
