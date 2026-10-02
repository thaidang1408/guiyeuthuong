// Hiệu ứng đặc biệt (dùng chung cho trình duyệt và server):
//   - "Màn mở đầu", "Hiệu ứng nền": gắn được vào mọi mẫu thiệp.
//   - FINALES: hiệu ứng toàn màn hình. Nay mỗi hiệu ứng là một mẫu "thiệp hiệu ứng" riêng
//     (xem `effect` trong templates.js). Thiệp cũ đã gắn màn kết vẫn chạy bình thường.
// id rỗng = không dùng. Thêm hiệu ứng mới: khai báo ở đây + viết file trong public/js/fx/.

export const OPENINGS = [
  { id: '', emoji: '💌', name: 'Mặc định', desc: 'Màn "Chạm để mở" của mẫu thiệp' },
  { id: 'hop-qua', emoji: '🎁', name: 'Hộp quà bí mật', desc: 'Chạm lắc hộp 3 lần, nắp bung ra cùng tia sáng' },
  { id: 'sac-tim', emoji: '🔋', name: 'Sạc đầy yêu thương', desc: 'Giữ tay lên trái tim cho tới khi đầy 100%' },
  { id: 'ghep-anh', emoji: '🧩', name: 'Ghép ảnh mới mở', desc: 'Xếp đúng 9 mảnh ảnh đầu tiên của bạn', needsPhoto: true },
];

export const FINALES = [
  { id: '', emoji: '➖', name: 'Không có', desc: 'Kết thúc ở lá thư' },
  { id: 'thien-ha', emoji: '🌌', name: 'Vũ trụ của tụi mình', desc: 'Thiên hà 3D xoay, tên và ảnh của hai bạn bay quanh. Kéo để xoay' },
  { id: 'tim-hat', emoji: '💗', name: 'Trái tim nghìn hạt sáng', desc: 'Trái tim 3D từ hàng nghìn hạt sáng, đập theo nhịp' },
  { id: 'ten-sao', emoji: '✨', name: 'Tên em bằng ngàn vì sao', desc: 'Sao trời tụ lại thành tên người nhận. Chạm vào là tung ra' },
  { id: 'tim-anh', emoji: '🖼️', name: 'Trái tim kỷ niệm', desc: 'Ảnh của bạn bay vào xếp thành trái tim đang đập' },
];

/** Hiệu ứng nền chạy suốt thiệp (sau lớp chữ). */
export const BACKGROUNDS = [
  { id: '', emoji: '➖', name: 'Không có', desc: 'Chỉ quầng sáng nhẹ của mẫu' },
  { id: 'dom-dom', emoji: '✨', name: 'Đom đóm', desc: 'Đốm sáng vàng lập loè bay chậm' },
  { id: 'bong-bong', emoji: '🫧', name: 'Bong bóng', desc: 'Bong bóng xà phòng óng ánh bay lên' },
  { id: 'buom', emoji: '🦋', name: 'Bướm bay', desc: 'Những chú bướm vỗ cánh lượn quanh' },
  { id: 'tuyet', emoji: '❄️', name: 'Tuyết rơi', desc: 'Tuyết trắng rơi lất phất' },
  { id: 'sao', emoji: '🌠', name: 'Trời sao', desc: 'Sao lấp lánh và sao băng' },
  { id: 'tim-bay', emoji: '💕', name: 'Tim bay', desc: 'Trái tim nhỏ bay lên lững lờ' },
];

export const FX_PHRASE_MAX = 40;

const DEFAULT_BG = { 'to-tinh': 'tim-bay', 'o-canh-em': 'dom-dom', 'sinh-nhat': 'bong-bong', 'mo-khi': 'sao', 'di-choi': 'buom' };

export const defaultFx = (templateId) => ({ opening: '', finale: '', bg: DEFAULT_BG[templateId] || '', phrase: '' });

const OPENING_IDS = new Set(OPENINGS.map((o) => o.id));
const FINALE_IDS = new Set(FINALES.map((f) => f.id));
const BG_IDS = new Set(BACKGROUNDS.map((b) => b.id));

/** Chỉ giữ id hợp lệ; câu chữ (phrase) do nơi gọi tự kiểm tra độ dài/từ thô tục. */
export function pickFxIds(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  return {
    opening: typeof input.opening === 'string' && OPENING_IDS.has(input.opening) ? input.opening : '',
    finale: typeof input.finale === 'string' && FINALE_IDS.has(input.finale) ? input.finale : '',
    bg: typeof input.bg === 'string' && BG_IDS.has(input.bg) ? input.bg : '',
  };
}

/** Câu hiện trong màn kết khi người tạo để trống. */
export const defaultPhrase = (name) => `Thương ${name || 'cậu'} nhiều lắm`;

/**
 * Gói hiệu ứng gợi ý: bấm một lần là có đủ mở đầu + nền + màn kết + trò chơi.
 * id 'goi-y' = gợi ý riêng của từng mẫu (defaultFx). Thêm gói mới: thêm một dòng ở đây.
 */
export const PRESETS = [
  { id: 'goi-y', emoji: '💡', name: 'Gợi ý cho mẫu này', desc: 'Bộ hiệu ứng hợp nhất với mẫu bạn chọn' },
  { id: 'lang-man', emoji: '💘', name: 'Lãng mạn', desc: 'Mở hộp quà · tim bay suốt thiệp', fx: { opening: 'hop-qua', bg: 'tim-bay', finale: '' }, game: '' },
  { id: 'dinh-noc', emoji: '🔥', name: 'Đỉnh nóc', desc: 'Sạc tim · nền sao · vòng quay quà ở cuối', fx: { opening: 'sac-tim', bg: 'sao', finale: '' }, game: 'vong-quay' },
  { id: 'vui-nhon', emoji: '🎉', name: 'Vui nhộn', desc: 'Mở hộp quà · bong bóng · câu đố ở cuối', fx: { opening: 'hop-qua', bg: 'bong-bong', finale: '' }, game: 'cau-do' },
  { id: 'nhe-nhang', emoji: '🍃', name: 'Nhẹ nhàng', desc: 'Chỉ đom đóm lập loè, không thêm màn nào', fx: { opening: '', bg: 'dom-dom', finale: '' }, game: '' },
];

/** Cấu hình hiệu ứng của một gói (cho mẫu templateId). */
export function presetFx(preset, templateId) {
  if (preset.id === 'goi-y') {
    const d = defaultFx(templateId);
    return { fx: { opening: d.opening, bg: d.bg, finale: d.finale }, game: '' };
  }
  return { fx: preset.fx, game: preset.game };
}

/** Gói đang khớp với lựa chọn hiện tại (null = người dùng tự tuỳ chỉnh). */
export function matchPreset(fx, gameId, templateId) {
  return (
    PRESETS.find((p) => {
      const v = presetFx(p, templateId);
      return v.fx.opening === (fx?.opening || '') && v.fx.bg === (fx?.bg || '') && v.fx.finale === (fx?.finale || '') && v.game === (gameId || '');
    }) || null
  );
}
