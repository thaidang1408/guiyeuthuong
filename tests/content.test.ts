// Kiểm tra nội dung: thư viện lời chúc và các mẫu thiệp mới.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { TEMPLATES, defaultCardData, textDefault } from '../public/js/shared/templates.js';
import { fillPronouns, pronounOptions } from '../public/js/shared/pronouns.js';
import { validateCardData } from '../functions/_lib/domain/card-data.ts';
import { findBadWord } from '../functions/_lib/domain/profanity.ts';

const wishes = JSON.parse(readFileSync(new URL('../public/data/loi-chuc.json', import.meta.url), 'utf8')) as Record<string, Record<string, string[]>>;
type Tpl = { ready: boolean; relationships: string[]; texts: Record<string, { max: number; suggest?: boolean }> };
const templates = TEMPLATES as unknown as Record<string, Tpl>;

describe('thư viện lời chúc', () => {
  it('có khoảng 90–160 lời (8 mẫu thiệp)', () => {
    const total = Object.values(wishes).flatMap((g) => Object.values(g)).flat().length;
    assert.ok(total >= 85 && total <= 200, `hiện có ${total} lời`);
  });

  it('mỗi mẫu đã ra mắt có lời chúc cho mọi mối quan hệ, mỗi nhóm 6–10 lời', () => {
    for (const [id, tpl] of Object.entries(templates)) {
      // Mẫu không có ô "Gợi ý lời nhắn" (ví dụ thư Mở khi…) thì không cần lời chúc.
      if (!tpl.ready || !Object.values(tpl.texts).some((f) => f.suggest)) continue;
      for (const rel of tpl.relationships) {
        const group = wishes[id]?.[rel];
        assert.ok(group, `thiếu lời chúc cho ${id}/${rel}`);
        assert.ok(group.length >= 6 && group.length <= 10, `${id}/${rel} có ${group.length} lời`);
      }
    }
  });

  it('không có nhóm thừa (mẫu hoặc mối quan hệ không tồn tại)', () => {
    for (const [id, groups] of Object.entries(wishes)) {
      assert.ok(templates[id], `mẫu lạ: ${id}`);
      for (const rel of Object.keys(groups)) assert.ok(templates[id].relationships.includes(rel), `quan hệ lạ: ${id}/${rel}`);
    }
  });

  it('mỗi lời: 2–5 câu, vừa ô lời nhắn, không có từ thô tục, không trùng nhau', () => {
    const seen = new Set<string>();
    for (const [id, groups] of Object.entries(wishes)) {
      const max = Object.values(templates[id].texts).find((f) => f.suggest)!.max;
      for (const [rel, list] of Object.entries(groups)) {
        for (const w of list) {
          const filled = w.replaceAll('{ten}', 'Nguyễn Thị Phương Linh');
          assert.ok([...filled].length <= max, `quá dài: ${w.slice(0, 40)}`);
          const sentences = w.split(/[.!?…]+/).filter((s) => s.trim().length > 3).length;
          assert.ok(sentences >= 2 && sentences <= 5, `${id}/${rel} có ${sentences} câu: ${w.slice(0, 50)}`);
          assert.equal(findBadWord(w), null, w);
          assert.ok(!seen.has(w), `trùng: ${w.slice(0, 40)}`);
          seen.add(w);
        }
      }
    }
  });
});

describe('mẫu 20/10 và xin lỗi', () => {
  it('chữ mặc định đổi theo mối quan hệ', () => {
    assert.equal(textDefault('phu-nu-2010', 'envelope', 'me'), 'Gửi mẹ yêu của con');
    assert.equal(textDefault('phu-nu-2010', 'envelope', 'co-giao'), 'Kính gửi cô {ten}');
    assert.equal(defaultCardData('phu-nu-2010', 'vo').texts.title, 'Cảm ơn em, người phụ nữ của anh 💐');
    // quan hệ không thuộc mẫu → dùng quan hệ đầu tiên
    assert.equal(defaultCardData('phu-nu-2010', 'crush').relationship, 'me');
  });

  it('server điền chữ mặc định đúng giọng văn khi bỏ trống', () => {
    const d = validateCardData('phu-nu-2010', { recipientName: 'Hoa', senderName: 'Nam', relationship: 'dong-nghiep', texts: {} });
    assert.equal(d.texts.envelope, 'Gửi chị {ten}');
    assert.equal(d.texts.title, 'Chúc mừng ngày 20/10 🌷');
  });

  it('mẫu xin lỗi giữ các dòng năn nỉ (nhiều dòng)', () => {
    const d = validateCardData('xin-loi', {
      recipientName: 'An',
      senderName: 'Bình',
      relationship: 'ban-than',
      texts: { pleas: 'Thật hả?\nNghĩ lại đi\n\n\n\nNăn nỉ mà' },
    });
    assert.equal(d.texts.pleas, 'Thật hả?\nNghĩ lại đi\n\nNăn nỉ mà');
  });

  it('cả 8 mẫu thiệp + 4 thiệp hiệu ứng đều đã ra mắt', () => {
    assert.deepEqual(
      Object.entries(templates).filter(([, t]) => t.ready).map(([id]) => id),
      ['to-tinh', 'phu-nu-2010', 'xin-loi', 'o-canh-em', 'ca-nhom', 'mo-khi', 'sinh-nhat', 'di-choi', 'chuyen-tinh', 'so-tay', 'vu-tru', 'tim-sang', 'ten-sao', 'tim-anh'],
    );
  });

  it('mẫu "Chuyện tình": giữ đủ các dòng kỷ niệm, ngày yêu phải hợp lệ, giọng vợ chồng', () => {
    const base = { recipientName: 'Người ấy', senderName: 'Tớ', relationship: 'nguoi-yeu' };
    const d = validateCardData('chuyen-tinh', { ...base, texts: { loveStart: '2023-05-20', moments: 'Lần đầu gặp\nBuổi hẹn đầu' } });
    assert.equal(d.texts.loveStart, '2023-05-20');
    assert.equal(d.texts.moments, 'Lần đầu gặp\nBuổi hẹn đầu');
    assert.equal(d.texts.storyTitle, 'Chuyện tình của tớ và cậu 💞');
    assert.throws(() => validateCardData('chuyen-tinh', { ...base, texts: { loveStart: '20/05/2023' } }), /không phải ngày hợp lệ/);
    assert.equal(defaultCardData('chuyen-tinh', 'vo').texts.promise, 'Anh hứa sẽ thương em và lo cho nhà mình thật tốt');
    assert.ok(defaultCardData('chuyen-tinh', 'chong').texts.message.startsWith('Cảm ơn anh đã cùng em'));
  });

  it('kiểu chữ: giữ kiểu hợp lệ, kiểu lạ thì về mặc định; mẫu 20/10 gợi ý "Sang trọng"', () => {
    const base = { recipientName: 'Người ấy', senderName: 'Tớ' };
    assert.equal(validateCardData('to-tinh', { ...base, font: 'de-thuong' }).font, 'de-thuong');
    assert.equal(validateCardData('to-tinh', { ...base, font: "x'); }" }).font, '');
    assert.equal(validateCardData('to-tinh', base).font, '');
    assert.equal(defaultCardData('phu-nu-2010').font, 'sang-trong');
    assert.equal(defaultCardData('to-tinh').font, 'mem-mai');
  });

  it('thiệp hiệu ứng: chạy đúng hiệu ứng có thật, không gắn thêm màn kết/nền', () => {
    for (const [id, effect] of [['vu-tru', 'thien-ha'], ['tim-sang', 'tim-hat'], ['ten-sao', 'ten-sao'], ['tim-anh', 'tim-anh']]) {
      assert.equal((TEMPLATES as Record<string, { effect?: string }>)[id].effect, effect);
      assert.ok(readFileSync(new URL(`../public/js/fx/${effect}.js`, import.meta.url), 'utf8').includes('export'), effect);
      const d = validateCardData(id, { recipientName: 'Người ấy', senderName: 'Tớ', fx: { finale: 'thien-ha', bg: 'sao', opening: 'hop-qua' } });
      assert.deepEqual([d.fx?.finale, d.fx?.bg, d.fx?.opening], ['', '', 'hop-qua']);
    }
    // Chữ mặc định theo xưng hô: gửi mẹ thì "con – mẹ".
    assert.equal(textDefault('ten-sao', 'phrase', 'me'), 'Con thương mẹ nhiều lắm');
    assert.equal(textDefault('vu-tru', 'intro', 'nguoi-yeu', 'anh-em'), 'Anh gói cả vũ trụ gửi em nè, chạm nhẹ để mở nhé');
  });
});

describe('mẫu "Muốn ở cạnh nhau"', () => {
  it('ô ngày: để trống được, nhận ngày thật, từ chối ngày sai', () => {
    const base = { recipientName: 'Linh', senderName: 'Minh', relationship: 'nguoi-yeu' };
    const d = validateCardData('o-canh-em', { ...base, texts: { loveStart: '2024-02-14', nextMeet: '' } });
    assert.equal(d.texts.loveStart, '2024-02-14');
    assert.equal(d.texts.nextMeet, '');
    assert.equal(d.texts.holdHint, 'Giữ tay lên màn hình, để tớ ôm cậu một cái nhé 🫂'); // mặc định tớ – cậu
    for (const bad of ['2024-02-30', '14/02/2024', '1800-01-01', '<script>']) {
      assert.throws(() => validateCardData('o-canh-em', { ...base, texts: { loveStart: bad } }), /không phải ngày hợp lệ/, bad);
    }
  });
  it('gửi vợ thì giọng văn vợ chồng', () => {
    assert.equal(textDefault('o-canh-em', 'meetText', 'vo'), 'nữa là anh về với vợ rồi');
    assert.equal(defaultCardData('o-canh-em', 'vo').texts.reasonsTitle, 'Những lúc anh thương vợ nhất');
  });
});

describe('Cách xưng hô (nam lẫn nữ đều dùng được)', () => {
  const base = { recipientName: 'Người ấy', senderName: 'Tớ', texts: {} };

  it('chữ mặc định đổi theo cách xưng hô', () => {
    assert.equal(textDefault('to-tinh', 'question', 'crush', 'to-cau'), 'Làm người yêu tớ nhé?');
    assert.equal(textDefault('to-tinh', 'question', 'crush', 'anh-em'), 'Làm người yêu anh nhé?');
    assert.equal(textDefault('to-tinh', 'question', 'crush', 'em-anh'), 'Làm người yêu em nhé?');
    assert.equal(textDefault('mo-khi', 'l2Title', 'nguoi-yeu', 'em-anh'), 'Mở khi anh nhớ em');
    assert.equal(textDefault('xin-loi', 'message', 'ban-than', 'tui-ong').startsWith('Tui xin lỗi vì đã làm ông buồn.'), true);
    assert.equal(textDefault('o-canh-em', 'reasonsTitle', 'chong'), 'Những lúc em thương chồng nhất');
  });

  it('server lưu cách xưng hô hợp lệ, sai thì lấy mặc định của mối quan hệ', () => {
    assert.equal(validateCardData('to-tinh', { ...base, relationship: 'nguoi-yeu', pronoun: 'em-anh' }).pronoun, 'em-anh');
    assert.equal(validateCardData('to-tinh', { ...base, relationship: 'nguoi-yeu', pronoun: 'hack' }).pronoun, 'to-cau');
    assert.equal(validateCardData('phu-nu-2010', { ...base, relationship: 'me', pronoun: 'anh-em' }).pronoun, 'con-me');
    // Ngày 20/10 người nhận là nữ: không có "em – anh".
    assert.equal(validateCardData('phu-nu-2010', { ...base, relationship: 'nguoi-yeu', pronoun: 'em-anh' }).pronoun, 'anh-em');
    const d = validateCardData('to-tinh', { ...base, relationship: 'crush', pronoun: 'em-anh' });
    assert.equal(d.texts.afterYes, 'Biết ngay mà! Thương anh nhiều 💕');
  });

  it('cho tự nhập mối quan hệ và cách xưng hô', () => {
    const d = validateCardData('phu-nu-2010', { ...base, relationship: 'khac', relationshipLabel: 'Bà ngoại', pronoun: { toi: ' Cháu ', ban: 'bà' } });
    assert.equal(d.relationship, 'khac');
    assert.equal(d.relationshipLabel, 'Bà ngoại');
    assert.deepEqual(d.pronoun, { toi: 'cháu', ban: 'bà' });
    assert.ok(Object.values(d.texts).every((v) => !/\{(toi|Toi|ban|Ban)\}/.test(v)));
    assert.equal(fillPronouns('{Toi} thương {ban}', d.pronoun), 'Cháu thương bà');
    // Từ lạ (số, ký tự đặc biệt, quá dài) → quay về cách mặc định.
    for (const bad of [{ toi: '<b>', ban: 'bà' }, { toi: 'cháu', ban: '' }, { toi: 'a'.repeat(13), ban: 'bà' }, 'hack']) {
      assert.equal(typeof validateCardData('to-tinh', { ...base, pronoun: bad }).pronoun, 'string');
    }
    // Mối quan hệ lạ vẫn bị bỏ; nhãn chỉ giữ khi chọn "Khác".
    assert.equal(validateCardData('to-tinh', { ...base, relationship: 'hack' }).relationship, 'crush');
    assert.equal(validateCardData('to-tinh', { ...base, relationshipLabel: 'X' }).relationshipLabel, undefined);
  });

  it('không còn chỗ trống xưng hô nào sau khi điền (mọi mẫu, mọi lời chúc)', () => {
    for (const [id, tpl] of Object.entries(TEMPLATES)) {
      for (const rel of tpl.relationships) {
        for (const pro of pronounOptions(tpl, rel)) {
          for (const v of Object.values(defaultCardData(id, rel, pro).texts)) {
            assert.ok(!/\{(toi|Toi|ban|Ban)\}/.test(v), `${id}/${rel}/${pro}: ${v}`);
          }
        }
      }
    }
    for (const group of Object.values(wishes)) {
      for (const list of Object.values(group)) {
        for (const w of list) assert.ok(!/\{(?!ten\}|toi\}|Toi\}|ban\}|Ban\})/.test(w), `chỗ trống lạ: ${w}`);
      }
    }
  });
});
