// ĐỊNH NGHĨA MẪU THIỆP — dùng chung cho trình tạo (trình duyệt) và kiểm tra dữ liệu (server).
// Thêm mẫu mới: thêm một mục vào TEMPLATES, rồi tạo public/js/templates/<id>.js và css tương ứng.
import { defaultFx } from './effects.js';
import { defaultFont } from './fonts.js';
import { fillPronouns, pickPronoun } from './pronouns.js';

export const RELATIONSHIPS = {
  me: 'Mẹ',
  'nguoi-yeu': 'Người yêu',
  vo: 'Vợ',
  chong: 'Chồng',
  'co-giao': 'Cô giáo',
  'ban-than': 'Bạn thân',
  'dong-nghiep': 'Đồng nghiệp',
  crush: 'Crush',
  khac: 'Khác',
};

/** Mọi mẫu đều cho chọn "Khác" (người dùng tự gõ tên mối quan hệ, chữ mặc định dùng bản chung của mẫu). */
export const relationshipsOf = (tpl) => [...tpl.relationships, 'khac'];
export const RELATIONSHIP_LABEL_MAX = 20;

export const MUSIC = [
  { id: 'none', name: 'Không dùng nhạc' },
  { id: 'nhac-1', name: 'Bản số 1 · Nhẹ nhàng' },
  { id: 'nhac-2', name: 'Bản số 2 · Ngọt ngào' },
  { id: 'nhac-3', name: 'Bản số 3 · Vui tươi' },
  { id: 'nhac-4', name: 'Bản số 4 · Lãng mạn' },
  { id: 'nhac-5', name: 'Bản số 5 · Sâu lắng' },
];

/** Các trường chung cho mọi mẫu. */
export const COMMON_FIELDS = {
  recipientName: { label: 'Tên người nhận', max: 40, required: true, placeholder: 'Ví dụ: Người ấy, Ẻm, Bé Mây…' },
  senderName: { label: 'Tên của bạn (ký tên cuối thiệp)', max: 40, required: true, placeholder: 'Ví dụ: Tớ, Người thương của cậu…' },
};

export const TEMPLATES = {
  'to-tinh': {
    id: 'to-tinh',
    ready: true,
    name: 'Làm người yêu tớ nhé?',
    tagline: 'Nút "Không" sẽ bỏ chạy, chỉ còn cách bấm "Có" thôi!',
    emoji: '💘',
    relationships: ['crush', 'nguoi-yeu'],
    defaultMusic: 'nhac-2',
    texts: {
      question: { label: 'Câu hỏi lớn', max: 100, default: 'Làm người yêu {toi} nhé?' },
      yesText: { label: 'Chữ trên nút "Có"', max: 20, default: 'Có 💖' },
      noText: { label: 'Chữ trên nút "Không"', max: 20, default: 'Không' },
      afterYes: { label: 'Câu hiện ra khi bấm "Có"', max: 80, default: 'Biết ngay mà! Thương {ban} nhiều 💕' },
      secret: {
        label: 'Bí mật (người nhận phải cào mới thấy, bỏ trống nếu không dùng)',
        max: 120,
        default: 'Thật ra {toi} đã để ý {ban} từ lâu lắm rồi 🙈',
      },
      message: {
        label: 'Lời nhắn bí mật',
        max: 1000,
        multiline: true,
        suggest: true,
        default:
          'Từ hôm đầu gặp {ban}, {toi} đã muốn nói câu này lâu lắm rồi. Cảm ơn {ban} vì đã đồng ý nha. Từ giờ có chuyện gì vui buồn, cứ kể {toi} nghe nhé!',
      },
    },
  },
  'phu-nu-2010': {
    id: 'phu-nu-2010',
    ready: true,
    name: 'Gửi người phụ nữ đặc biệt',
    tagline: 'Mở phong bì, hoa rơi, ảnh kỷ niệm và lời chúc hiện từng chữ.',
    emoji: '🌷',
    relationships: ['me', 'nguoi-yeu', 'vo', 'co-giao', 'ban-than', 'dong-nghiep'],
    defaultMusic: 'nhac-1',
    // Ngày của phụ nữ: người nhận là nữ, nên không có cách "em – anh"; bạn thân giữ giọng "tui – bà".
    pronouns: { 'nguoi-yeu': ['anh-em', 'to-cau'], 'ban-than': ['tui-ba'] },
    texts: {
      envelope: { label: 'Chữ trên phong bì', max: 40, default: 'Gửi người phụ nữ đặc biệt' },
      title: { label: 'Tiêu đề lời chúc', max: 60, default: 'Chúc mừng 20/10 💐' },
      message: { label: 'Lời chúc', max: 1000, multiline: true, suggest: true, default: 'Chúc {ten} một ngày 20/10 thật nhiều niềm vui, luôn khỏe mạnh và được yêu thương thật nhiều.' },
    },
    /** Chữ mặc định khác nhau theo mối quan hệ ({ten} = tên người nhận). */
    relationshipDefaults: {
      me: {
        envelope: 'Gửi mẹ yêu của con',
        title: 'Con thương mẹ nhiều 💐',
        message: 'Mẹ ơi, cảm ơn mẹ vì tất cả những bữa cơm, những lần thức khuya và cả những lần mẹ lo cho con mà không nói ra. Hôm nay con chỉ mong mẹ nghỉ ngơi một chút, cười nhiều hơn một chút. Con thương mẹ nhiều lắm.',
      },
      'nguoi-yeu': {
        envelope: 'Gửi {ten} của {toi}',
        title: 'Chúc {ban} 20/10 thật vui 💕',
        message: 'Cảm ơn {ban} đã đến và làm những ngày bình thường của {toi} trở nên đáng nhớ. Hôm nay là ngày của {ban}, nên {ban} cứ việc được chiều, được nũng nịu, được cười thật tươi nhé. {Toi} thương {ban}.',
      },
      vo: {
        envelope: 'Gửi vợ yêu',
        title: 'Cảm ơn em, người phụ nữ của anh 💐',
        message: 'Cảm ơn em đã cùng anh đi qua bao nhiêu ngày vui buồn, đã giữ cho nhà mình lúc nào cũng ấm. Anh biết em vất vả nhiều. Hôm nay để anh lo mọi thứ, em chỉ cần nghỉ ngơi và vui thôi nhé.',
      },
      'co-giao': {
        envelope: 'Kính gửi cô {ten}',
        title: 'Em cảm ơn cô 🌷',
        message: 'Em cảm ơn cô vì những bài giảng tận tâm và cả những lần cô kiên nhẫn với tụi em. Nhân ngày 20/10, em chúc cô luôn mạnh khỏe, vui vẻ và mãi giữ nụ cười hiền như mỗi lần bước vào lớp.',
      },
      'ban-than': {
        envelope: 'Gửi bà bạn thân {ten}',
        title: '20/10 vui vẻ nha bạn iu 🌸',
        message: 'Chúc bà bạn thân của tui 20/10 thật xinh, thật vui, ăn hoài không mập. Cảm ơn bà đã luôn ở đó nghe tui than thở. Có gì cứ gọi, tui luôn sẵn sàng nha!',
      },
      'dong-nghiep': {
        envelope: 'Gửi chị {ten}',
        title: 'Chúc mừng ngày 20/10 🌷',
        message: 'Chúc chị một ngày 20/10 thật nhiều niềm vui. Cảm ơn chị đã luôn nhiệt tình hỗ trợ cả nhóm. Chúc chị luôn khỏe, luôn xinh và công việc lúc nào cũng thuận lợi.',
      },
    },
  },
  'xin-loi': {
    id: 'xin-loi',
    ready: true,
    name: 'Tha lỗi cho tớ nhé',
    tagline: 'Nút "Không tha" nhỏ dần qua mỗi lần bấm rồi biến mất.',
    emoji: '🥺',
    relationships: ['nguoi-yeu', 'ban-than', 'crush'],
    defaultMusic: 'nhac-5',
    texts: {
      question: { label: 'Câu hỏi lớn', max: 100, default: 'Tha lỗi cho {toi} nhé? 🥺' },
      yesText: { label: 'Chữ trên nút "Tha"', max: 20, default: 'Tha cho đó 🥰' },
      noText: { label: 'Chữ trên nút "Không tha"', max: 20, default: 'Không tha' },
      pleas: {
        label: 'Chữ đổi trên nút "Không tha" (mỗi dòng một câu)',
        max: 300,
        multiline: true,
        default: ['Thật không?', 'Nghĩ lại đi mà 🥺', '{Toi} biết lỗi rồi mà', 'Cho {toi} một cơ hội thôi', 'Năn nỉ đó…'].join('\n'),
      },
      afterYes: { label: 'Câu hiện ra khi bấm "Tha"', max: 80, default: 'Thương {ban} nhất trên đời 💗' },
      coupon: {
        label: 'Phiếu chuộc lỗi (người nhận cào mới thấy, bỏ trống nếu không dùng)',
        max: 120,
        default: 'Phiếu chuộc lỗi: 1 ly trà sữa + 1 buổi đi chơi, {toi} bao hết 🧋',
      },
      message: {
        label: 'Lời nhắn',
        max: 1000,
        multiline: true,
        suggest: true,
        default: '{Toi} xin lỗi vì đã làm {ban} buồn. {Toi} đã nghĩ lại nhiều rồi, và lần sau {toi} sẽ để ý hơn. Cảm ơn {ban} đã tha cho {toi} nha.',
      },
    },
  },
  'o-canh-em': {
    id: 'o-canh-em',
    ready: true,
    name: 'Muốn ở cạnh nhau',
    tagline: 'Giữ tay lên màn hình để hai trái tim chạm nhau, kèm đếm ngày yêu và đếm ngược tới lần gặp tới.',
    emoji: '🫂',
    relationships: ['nguoi-yeu', 'vo', 'chong'],
    defaultMusic: 'nhac-4',
    texts: {
      loveStart: { label: 'Ngày bắt đầu yêu nhau', type: 'date', max: 10, hint: 'Để đếm "mình đã bên nhau bao nhiêu ngày". Bỏ trống nếu không muốn hiện.' },
      holdHint: { label: 'Câu ở màn "ôm"', max: 80, default: 'Giữ tay lên màn hình, để {toi} ôm {ban} một cái nhé 🫂' },
      afterHug: { label: 'Câu hiện ra khi hai trái tim chạm nhau', max: 80, default: 'Giá mà lúc này {toi} đang ôm {ban} thật 🤍' },
      reasonsTitle: { label: 'Tiêu đề danh sách', max: 60, default: 'Những lúc {toi} nhớ {ban} nhất' },
      reasons: {
        label: 'Danh sách (mỗi dòng một ý)',
        max: 400,
        multiline: true,
        default: [
          'Khi thấy món {ban} thích ở đâu đó',
          'Mỗi tối trước khi ngủ',
          'Khi có chuyện vui, chỉ muốn kể {ban} nghe đầu tiên',
          'Khi trời trở lạnh mà không có tay {ban} để nắm',
          'Thật ra là lúc nào cũng nhớ 🙈',
        ].join('\n'),
      },
      message: {
        label: 'Lời nhắn',
        max: 1000,
        multiline: true,
        suggest: true,
        default:
          'Dù ngày hôm đó có bận đến đâu, cuối ngày {toi} vẫn chỉ muốn được ở cạnh {ban}. Cảm ơn {ban} đã kiên nhẫn với {toi}, đã thương {toi} nhiều như vậy. Mình cứ bên nhau thật lâu, thật lâu {ban} nhé.',
      },
      nextMeet: { label: 'Ngày hẹn gặp nhau tới (không bắt buộc)', type: 'date', max: 10, hint: 'Thiệp sẽ đếm ngược tới ngày này. Hợp cho cặp đôi yêu xa.' },
      meetText: { label: 'Câu đếm ngược', max: 60, default: 'nữa là mình được gặp nhau rồi' },
    },
    relationshipDefaults: {
      vo: {
        holdHint: 'Giữ tay lên màn hình, cho anh ôm vợ một cái nào 🫂',
        afterHug: 'Chỉ muốn về nhà ôm vợ thật chặt 🤍',
        reasonsTitle: 'Những lúc anh thương vợ nhất',
        reasons: [
          'Khi về nhà thấy đèn còn sáng chờ anh',
          'Khi em cằn nhằn mà vẫn gắp đồ ăn cho anh',
          'Mỗi sáng thức dậy thấy em bên cạnh',
          'Khi em mệt mà vẫn cười với anh',
          'Thật ra là ngày nào cũng thương 🙈',
        ].join('\n'),
        message:
          'Cưới nhau rồi, có những ngày bận rộn anh quên nói lời thương. Nhưng chưa ngày nào anh thôi biết ơn vì có em bên cạnh. Cảm ơn vợ đã cùng anh đi qua mọi chuyện, mình cứ thương nhau như thế đến già nhé.',
        meetText: 'nữa là anh về với vợ rồi',
      },
      chong: {
        holdHint: 'Giữ tay lên màn hình, cho em ôm chồng một cái nào 🫂',
        afterHug: 'Chỉ mong chồng về nhà ngay để em ôm thật chặt 🤍',
        reasonsTitle: 'Những lúc em thương chồng nhất',
        reasons: [
          'Khi anh đi làm về muộn mà vẫn nhắn hỏi em ăn chưa',
          'Khi anh lặng lẽ sửa hết mọi thứ hỏng trong nhà',
          'Mỗi sáng thức dậy thấy anh bên cạnh',
          'Khi anh mệt mà vẫn cười với em',
          'Thật ra là ngày nào cũng thương 🙈',
        ].join('\n'),
        message:
          'Cưới nhau rồi, có những ngày bận rộn em quên nói lời thương. Nhưng chưa ngày nào em thôi biết ơn vì có anh bên cạnh. Cảm ơn chồng đã cùng em đi qua mọi chuyện, mình cứ thương nhau như thế đến già nhé.',
        meetText: 'nữa là chồng về với em rồi',
      },
    },
  },
  'ca-nhom': {
    id: 'ca-nhom',
    ready: true,
    name: 'Cả nhóm gửi lời chúc',
    tagline: 'Cả lớp, cả phòng cùng ký tên vào một tấm thiệp. Hợp tặng cô giáo, chị em đồng nghiệp dịp 20/10.',
    emoji: '💐',
    group: true,
    relationships: ['co-giao', 'dong-nghiep', 'ban-than'],
    defaultMusic: 'nhac-1',
    texts: {
      groupName: { label: 'Tên nhóm gửi', max: 60, required: true, default: 'Tập thể lớp mình' },
      title: { label: 'Tiêu đề', max: 80, default: 'Chúc mừng ngày 20/10 💐' },
      message: {
        label: 'Lời chúc chung của cả nhóm',
        max: 1000,
        multiline: true,
        suggest: true,
        default: 'Nhân ngày 20/10, cả nhóm gửi đến {ten} những lời chúc chân thành nhất. Cảm ơn vì đã luôn ở bên, quan tâm và nâng đỡ mọi người. Chúc {ten} luôn khỏe, luôn vui và mãi xinh đẹp!',
      },
    },
    relationshipDefaults: {
      'co-giao': {
        groupName: 'Tập thể lớp',
        title: 'Kính chúc cô ngày 20/10 thật hạnh phúc 💐',
        message: 'Nhân ngày Phụ nữ Việt Nam 20/10, cả lớp kính chúc cô thật nhiều sức khỏe và niềm vui. Cảm ơn cô đã luôn kiên nhẫn, tận tâm với từng đứa tụi em. Tụi em thương cô nhiều lắm!',
      },
      'dong-nghiep': {
        groupName: 'Cả phòng',
        title: 'Chúc mừng ngày 20/10 các chị em 🌷',
        message: 'Nhân ngày 20/10, cả phòng gửi lời chúc đến {ten}: luôn xinh đẹp, vui vẻ và thành công. Cảm ơn vì đã làm cho mỗi ngày đi làm đều dễ chịu hơn!',
      },
    },
  },
  'mo-khi': {
    id: 'mo-khi',
    ready: true,
    name: 'Thư "Mở khi…"',
    tagline: 'Một xấp thư cho từng lúc: mở khi buồn, mở khi nhớ, có thư phải đợi đúng ngày mới mở được.',
    emoji: '✉️',
    relationships: ['nguoi-yeu', 'vo', 'chong', 'ban-than'],
    defaultMusic: 'nhac-1',
    texts: {
      intro: { label: 'Lời mở đầu', max: 200, multiline: true, default: '{Toi} viết sẵn mấy lá thư này cho {ban}. Mỗi lá dành cho một lúc, đừng mở hết một lần nha 💌' },
      l1Title: { label: 'Thư 1 · Mở khi…', max: 50, default: 'Mở khi {ban} buồn' },
      l1Body: { label: 'Thư 1 · Nội dung', max: 800, multiline: true, default: '{Ban} ơi, buồn thì cứ buồn một chút thôi nhé. Nhớ là lúc nào cũng có {toi} ở đây, chỉ cần {ban} gọi là {toi} nghe. Giờ thì hít một hơi thật sâu, rồi cười lên cho {toi} xem nào 🥰' },
      l1Date: { label: 'Thư 1 · Chỉ mở được từ ngày (không bắt buộc)', type: 'date', max: 10 },
      l2Title: { label: 'Thư 2 · Mở khi…', max: 50, default: 'Mở khi {ban} nhớ {toi}' },
      l2Body: { label: 'Thư 2 · Nội dung', max: 800, multiline: true, default: '{Toi} cũng đang nhớ {ban} đó. Nhắm mắt lại, tưởng tượng {toi} đang ôm {ban} thật chặt. Gọi cho {toi} đi, {toi} đang chờ.' },
      l2Date: { label: 'Thư 2 · Chỉ mở được từ ngày (không bắt buộc)', type: 'date', max: 10 },
      l3Title: { label: 'Thư 3 · Mở khi…', max: 50, default: 'Mở khi mình cãi nhau' },
      l3Body: { label: 'Thư 3 · Nội dung', max: 800, multiline: true, default: 'Dù mình đang giận nhau chuyện gì, {toi} vẫn thương {ban} nhiều hơn cơn giận đó. Mình nói chuyện với nhau nhé, {toi} sẽ nghe {ban} trước.' },
      l3Date: { label: 'Thư 3 · Chỉ mở được từ ngày (không bắt buộc)', type: 'date', max: 10 },
      l4Title: { label: 'Thư 4 · Mở khi… (bỏ trống nếu không dùng)', max: 50, default: '' },
      l4Body: { label: 'Thư 4 · Nội dung', max: 800, multiline: true, default: '' },
      l4Date: { label: 'Thư 4 · Chỉ mở được từ ngày (không bắt buộc)', type: 'date', max: 10 },
      l5Title: { label: 'Thư 5 · Mở khi… (bỏ trống nếu không dùng)', max: 50, default: '' },
      l5Body: { label: 'Thư 5 · Nội dung', max: 800, multiline: true, default: '' },
      l5Date: { label: 'Thư 5 · Chỉ mở được từ ngày (không bắt buộc)', type: 'date', max: 10 },
      l6Title: { label: 'Thư 6 · Mở khi… (bỏ trống nếu không dùng)', max: 50, default: '' },
      l6Body: { label: 'Thư 6 · Nội dung', max: 800, multiline: true, default: '' },
      l6Date: { label: 'Thư 6 · Chỉ mở được từ ngày (không bắt buộc)', type: 'date', max: 10 },
    },
    relationshipDefaults: {
      'ban-than': {
        intro: '{Toi} viết sẵn mấy lá thư này cho {ban}. Lúc nào cần thì mở đúng lá, đừng tham mở hết nha 😤',
        l1Title: 'Mở khi {ban} buồn',
        l1Body: 'Buồn gì kể {toi} nghe coi. Không kể được thì đi ăn, ăn xong tính tiếp. {Ban} có {toi} mà, sợ gì!',
        l2Title: 'Mở khi {ban} mệt mỏi',
        l2Body: 'Nghỉ một chút đi, thế giới không sập đâu. {Ban} đã cố gắng nhiều lắm rồi, {toi} biết mà.',
        l3Title: 'Mở khi mình giận nhau',
        l3Body: 'Thôi làm lành đi, giận lâu mệt lắm. {Toi} sai thì {toi} xin lỗi, {ban} sai thì {toi} cũng bỏ qua 😌',
      },
    },
  },
  'sinh-nhat': {
    id: 'sinh-nhat',
    ready: true,
    name: 'Chúc mừng sinh nhật',
    tagline: 'Bánh kem có nến thật: chạm hoặc thổi vào micro để tắt nến, rồi ước một điều.',
    emoji: '🎂',
    relationships: ['nguoi-yeu', 'ban-than', 'me', 'vo', 'chong'],
    defaultMusic: 'nhac-3',
    texts: {
      age: { label: 'Tuổi mới (không bắt buộc, ví dụ 20)', max: 3, default: '' },
      title: { label: 'Lời chúc lớn', max: 80, default: 'Chúc mừng sinh nhật {ten}! 🎉' },
      wishPrompt: { label: 'Câu nhắc ước', max: 80, default: 'Nhắm mắt lại, ước một điều thật to rồi chạm vào màn hình nhé…' },
      message: {
        label: 'Lời chúc',
        max: 1000,
        multiline: true,
        suggest: true,
        default: 'Chúc mừng sinh nhật! Chúc tuổi mới thật nhiều niềm vui, sức khỏe và những điều tuyệt vời nhất. Cảm ơn vì đã xuất hiện trong cuộc đời {toi}.',
      },
    },
    relationshipDefaults: {
      me: {
        title: 'Chúc mừng sinh nhật mẹ! 🎂',
        message: 'Chúc mừng sinh nhật mẹ! Con chúc mẹ luôn khỏe mạnh, vui vẻ và bớt lo cho con một chút. Cảm ơn mẹ vì tất cả, con thương mẹ nhiều lắm.',
      },
    },
  },
  'di-choi': {
    id: 'di-choi',
    ready: true,
    name: 'Đi chơi với tớ không?',
    tagline: 'Người ấy chọn ngày rảnh và món muốn ăn, bạn xem câu trả lời ngay.',
    emoji: '🍜',
    relationships: ['crush', 'nguoi-yeu', 'ban-than'],
    defaultMusic: 'nhac-3',
    texts: {
      question: { label: 'Câu rủ đi chơi', max: 100, default: 'Cuối tuần này đi chơi với {toi} không? 🥳' },
      yesText: { label: 'Chữ trên nút "Đi"', max: 20, default: 'Đi luôn! 🙌' },
      noText: { label: 'Chữ trên nút "Không"', max: 20, default: 'Bận rồi' },
      dateQuestion: { label: 'Câu hỏi chọn ngày', max: 80, default: 'Hôm nào {ten} rảnh nè? 📅' },
      foodQuestion: { label: 'Câu hỏi chọn món', max: 80, default: 'Mình đi ăn gì đây? 😋' },
      foods: {
        label: 'Các món để chọn (mỗi dòng một món)',
        max: 300,
        multiline: true,
        default: ['🍲 Lẩu', '🧋 Trà sữa', '🍕 Pizza', '🍜 Đồ Hàn', '🐌 Ốc', '🍦 Kem'].join('\n'),
      },
      afterAnswer: { label: 'Câu hiện ra sau khi trả lời', max: 80, default: 'Chốt kèo nha! Hẹn gặp {ten} 💛' },
      message: {
        label: 'Lời nhắn',
        max: 1000,
        multiline: true,
        suggest: true,
        default: 'Lâu rồi mình chưa đi đâu cùng nhau. {Toi} để dành sẵn một buổi thật vui, chỉ chờ {ban} gật đầu thôi. Hẹn {ban} nha!',
      },
    },
    relationshipDefaults: {
      'nguoi-yeu': {
        question: 'Hẹn hò với {toi} cuối tuần này nhé? 💕',
        afterAnswer: 'Chốt lịch hẹn rồi nha, nhớ mặc đẹp đó 😚',
        message: 'Dạo này cả hai bận quá, {toi} nhớ những buổi đi chơi của mình lắm. Lần này để {toi} lo hết, {ban} chỉ cần chọn ngày và món thôi. Hẹn gặp người thương nhé!',
      },
      'ban-than': {
        question: 'Đi quẩy một bữa không {ban}? 🎉',
        yesText: 'Chiến luôn! 🔥',
        noText: 'Lười lắm',
        afterAnswer: 'Kèo chốt rồi, cấm bùng nha {ten} 😤',
        message: 'Lâu lắm rồi tụi mình chưa ngồi buôn chuyện cho đã. Đi ăn một bữa, kể nhau nghe hết drama dạo này nha. Bùng là nghỉ chơi đó!',
      },
    },
  },
  'chuyen-tinh': {
    id: 'chuyen-tinh',
    ready: true,
    name: 'Chuyện tình của tụi mình',
    tagline: 'Kể chuyện tình hai bạn như story: đếm ngày yêu, từng kỷ niệm kèm ảnh, cuối cùng móc ngoéo hứa với nhau.',
    emoji: '💞',
    relationships: ['nguoi-yeu', 'vo', 'chong'],
    defaultMusic: 'nhac-4',
    texts: {
      loveStart: { label: 'Ngày hai bạn bắt đầu yêu (không bắt buộc)', max: 10, type: 'date', default: '' },
      storyTitle: { label: 'Tiêu đề câu chuyện', max: 60, default: 'Chuyện tình của {toi} và {ban} 💞' },
      moments: {
        label: 'Các kỷ niệm (mỗi dòng một kỷ niệm, tối đa 6 — ảnh ở dưới ghép theo thứ tự)',
        max: 600,
        multiline: true,
        default: [
          'Lần đầu gặp nhau, {toi} đã thấy {ban} thật đặc biệt',
          'Buổi hẹn đầu tiên, cả hai đều run run',
          'Chuyến đi chơi xa đầu tiên của tụi mình',
          'Những lần giận nhau rồi lại làm lành',
          'Và hôm nay, {toi} vẫn thương {ban} như ngày đầu',
        ].join('\n'),
      },
      promise: { label: 'Lời hứa (người nhận giữ tay để "móc ngoéo")', max: 100, default: 'Mình sẽ nắm tay nhau thật lâu, thật lâu nhé' },
      message: {
        label: 'Lời nhắn cuối',
        max: 1000,
        multiline: true,
        suggest: true,
        default: 'Cảm ơn {ban} đã cùng {toi} viết nên câu chuyện này. Có những ngày vui, có những ngày giận nhau, nhưng ngày nào {toi} cũng thấy may mắn vì có {ban}. Mình cứ thương nhau như vậy mãi nha.',
      },
    },
    relationshipDefaults: {
      vo: { storyTitle: 'Chuyện của anh và vợ 💞', promise: 'Anh hứa sẽ thương em và lo cho nhà mình thật tốt' },
      chong: { storyTitle: 'Chuyện của em và chồng 💞', promise: 'Mình cùng nhau đi hết đoạn đường còn lại nhé' },
    },
  },
  'so-tay': {
    id: 'so-tay',
    ready: true,
    // Sổ tình yêu chung: sau khi gửi, cả hai cùng viết thêm trang (xem functions/_lib/services/extras-service.ts).
    memoryBook: true,
    name: 'Sổ tình yêu chung',
    tagline: 'Cuốn sổ online của hai người: cả hai cùng viết thêm kỷ niệm kèm ảnh, mở lại lúc nào cũng thấy cả chặng đường.',
    emoji: '📔',
    relationships: ['nguoi-yeu', 'vo', 'chong'],
    defaultMusic: 'nhac-1',
    texts: {
      loveStart: { label: 'Ngày hai bạn bắt đầu yêu (không bắt buộc)', max: 10, type: 'date', default: '' },
      bookTitle: { label: 'Tên cuốn sổ', max: 60, default: 'Sổ tình yêu của {toi} và {ban}' },
      firstPage: {
        label: 'Trang đầu tiên (bạn viết)',
        max: 400,
        multiline: true,
        default: 'Trang đầu tiên của tụi mình nè. Từ giờ có chuyện gì vui, kỷ niệm gì đáng nhớ, {ban} cứ viết thêm vào đây nha. {Toi} cũng sẽ viết, để sau này mở ra là thấy cả một chặng đường.',
      },
    },
  },
  // ---- Thiệp hiệu ứng: mở link là chạy ngay một hiệu ứng toàn màn hình (effect = file trong public/js/fx/) ----
  'vu-tru': {
    id: 'vu-tru',
    ready: true,
    effect: 'thien-ha',
    name: 'Vũ trụ của tụi mình',
    tagline: 'Mở link là bay vào thiên hà 3D, tên và ảnh của hai bạn xoay quanh. Kéo tay để xoay.',
    emoji: '🌌',
    relationships: ['nguoi-yeu', 'crush', 'vo', 'chong', 'ban-than'],
    defaultMusic: 'nhac-4',
    texts: {
      intro: { label: 'Câu ở màn mở đầu', max: 80, default: '{Toi} gói cả vũ trụ gửi {ban} nè, chạm nhẹ để mở nhé' },
      phrase: { label: 'Câu yêu thương ở giữa vũ trụ', max: 40, default: 'Thương {ten} nhiều lắm' },
      lines: {
        label: 'Những câu nhỏ bay quanh (mỗi dòng một câu ngắn, tối đa 5 câu)',
        max: 200,
        multiline: true,
        default: ['{Toi} nhớ {ban}', 'Cảm ơn vì đã đến', 'Mãi bên nhau nhé', 'Ngày nào cũng vui', '{Ban} là nhất'].join('\n'),
      },
      message: {
        label: 'Lời nhắn sau cùng',
        max: 600,
        multiline: true,
        default: 'Giữa hàng tỉ ngôi sao ngoài kia, {toi} vẫn chỉ muốn tìm thấy {ban}. Cảm ơn {ban} đã ở đây và làm cả vũ trụ của {toi} sáng lên.',
      },
    },
    relationshipDefaults: {
      'ban-than': {
        phrase: 'Tri kỷ của {toi} là {ten}',
        message: 'Bạn bè thì nhiều, nhưng tri kỷ như {ban} thì chỉ có một. Cảm ơn {ban} đã luôn ở đó, cả lúc {toi} vui lẫn lúc {toi} tệ nhất.',
      },
    },
  },
  'tim-sang': {
    id: 'tim-sang',
    ready: true,
    effect: 'tim-hat',
    name: 'Trái tim nghìn hạt sáng',
    tagline: 'Trái tim 3D kết từ hàng nghìn hạt sáng, đập theo nhịp cùng tên người ấy.',
    emoji: '💗',
    relationships: ['crush', 'nguoi-yeu', 'vo', 'chong'],
    defaultMusic: 'nhac-2',
    texts: {
      intro: { label: 'Câu ở màn mở đầu', max: 80, default: 'Trái tim này đập vì ai, {ban} chạm vào là biết' },
      phrase: { label: 'Câu yêu thương dưới trái tim', max: 40, default: 'Thương {ten} nhiều lắm' },
      message: {
        label: 'Lời nhắn sau cùng',
        max: 600,
        multiline: true,
        default: 'Dạo này nhịp tim nào của {toi} cũng có tên {ban}. Không biết nói sao cho hay, nên {toi} gửi cả trái tim này luôn đó.',
      },
    },
  },
  'ten-sao': {
    id: 'ten-sao',
    ready: true,
    effect: 'ten-sao',
    name: 'Tên người ấy bằng ngàn vì sao',
    tagline: 'Sao trời tụ lại thành tên người nhận. Chạm vào là sao tung ra rồi xếp lại.',
    emoji: '✨',
    relationships: ['nguoi-yeu', 'crush', 'ban-than', 'me', 'vo', 'chong'],
    defaultMusic: 'nhac-1',
    texts: {
      intro: { label: 'Câu ở màn mở đầu', max: 80, default: 'Đêm nay có một bầu trời viết riêng cho {ban}' },
      phrase: { label: 'Câu yêu thương dưới tên', max: 40, default: 'Thương {ten} nhiều lắm' },
      message: {
        label: 'Lời nhắn sau cùng',
        max: 600,
        multiline: true,
        default: 'Trên trời có hàng nghìn vì sao, nhưng {toi} chỉ muốn xếp chúng thành tên {ban}. Mong mỗi tối ngước lên, {ban} đều nhớ có người luôn nghĩ về {ban}.',
      },
    },
    relationshipDefaults: {
      me: {
        intro: 'Đêm nay con gửi mẹ cả một bầu trời sao',
        phrase: 'Con thương mẹ nhiều lắm',
        message: 'Mẹ ơi, con không giỏi nói lời tình cảm, nên con nhờ các vì sao nói giúp. Cảm ơn mẹ vì tất cả, con thương mẹ nhiều lắm.',
      },
      'ban-than': {
        phrase: 'Bạn thân nhất của {toi}',
        message: 'Trên trời có bao nhiêu sao thì {toi} cũng chỉ có một đứa bạn thân như {ban}. Cảm ơn {ban} đã luôn ở đây, cả lúc vui lẫn lúc buồn.',
      },
    },
  },
  'tim-anh': {
    id: 'tim-anh',
    ready: true,
    effect: 'tim-anh',
    name: 'Trái tim kỷ niệm',
    tagline: 'Ảnh của hai bạn bay vào xếp thành trái tim đang đập. Thêm càng nhiều ảnh càng đẹp.',
    emoji: '🖼️',
    relationships: ['nguoi-yeu', 'vo', 'chong', 'ban-than', 'me'],
    defaultMusic: 'nhac-1',
    texts: {
      intro: { label: 'Câu ở màn mở đầu', max: 80, default: '{Toi} gom hết kỷ niệm của mình lại rồi nè, chạm để xem nhé' },
      phrase: { label: 'Câu dưới trái tim ảnh', max: 40, default: 'Mình có nhiều kỷ niệm đẹp ghê' },
      message: {
        label: 'Lời nhắn sau cùng',
        max: 600,
        multiline: true,
        default: 'Mỗi tấm ảnh là một ngày {toi} muốn giữ mãi. Cảm ơn {ban} đã cùng {toi} tạo nên chừng ấy kỷ niệm, và còn nhiều nữa ở phía trước.',
      },
    },
    relationshipDefaults: {
      me: {
        intro: 'Con gom lại những tấm ảnh của nhà mình nè mẹ',
        phrase: 'Con thương mẹ nhiều lắm',
        message: 'Mẹ ơi, nhìn lại mấy tấm ảnh này con mới thấy mẹ đã ở bên con trong từng khoảnh khắc. Cảm ơn mẹ, con thương mẹ nhiều lắm.',
      },
    },
  },
};

/** Mẫu "thiệp hiệu ứng" đang chạy hiệu ứng effectId (ví dụ 'thien-ha' → 'vu-tru'). */
export const templateForEffect = (effectId) => Object.values(TEMPLATES).find((t) => t.effect === effectId) || null;

/** Chữ mặc định của một ô, tính theo mối quan hệ và cách xưng hô (xem pronouns.js). */
export function textDefault(templateId, key, relationship, pronoun) {
  const tpl = TEMPLATES[templateId];
  const raw = tpl.relationshipDefaults?.[relationship]?.[key] ?? tpl.texts[key]?.default ?? '';
  return fillPronouns(raw, pickPronoun(tpl, relationship, pronoun));
}

/** Tạo dữ liệu thiệp mặc định cho một mẫu. */
export function defaultCardData(templateId, relationship, pronoun) {
  const tpl = TEMPLATES[templateId];
  const rel = relationshipsOf(tpl).includes(relationship) ? relationship : tpl.relationships[0];
  const pro = pickPronoun(tpl, rel, pronoun);
  const texts = {};
  for (const key of Object.keys(tpl.texts)) texts[key] = textDefault(templateId, key, rel, pro);
  return {
    recipientName: '',
    senderName: '',
    relationship: rel,
    pronoun: pro,
    music: tpl.defaultMusic,
    font: defaultFont(templateId),
    texts,
    fx: defaultFx(templateId),
  };
}
