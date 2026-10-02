import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { jsonForHtml } from '../functions/_lib/http/responses.ts';

describe('nhúng dữ liệu thiệp vào HTML', () => {
  it('không thể đóng thẻ script bằng nội dung người dùng nhập', () => {
    const out = jsonForHtml({ message: '</script><script>alert(1)</script> & <!--' });
    assert.ok(!out.includes('<'));
    assert.ok(!out.includes('>'));
    assert.ok(!out.includes('&'));
  });
  it('vẫn đọc lại đúng dữ liệu gốc', () => {
    const lineSep = String.fromCharCode(0x2028);
    const data = { message: `<b>Chào</b> & tạm biệt${lineSep}nhé` };
    const out = jsonForHtml(data);
    assert.ok(!out.includes(lineSep));
    assert.deepEqual(JSON.parse(out), data);
  });
});
