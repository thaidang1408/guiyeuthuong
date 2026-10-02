// Trò chơi nhỏ cuối thiệp (gắn được cho mọi mẫu). Dùng chung cho trình duyệt và server.
//   vong-quay — vòng quay quà tặng: server bốc thăm, mỗi thiệp chỉ quay 1 lần, người tạo xem được kết quả
//   cau-do    — "Bạn hiểu tớ bao nhiêu?": câu hỏi trắc nghiệm, server chấm điểm, người tạo xem từng câu trả lời

export const GAMES = [
  { id: '', emoji: '➖', name: 'Không có', desc: 'Không thêm trò chơi' },
  { id: 'vong-quay', emoji: '🎡', name: 'Vòng quay quà tặng', desc: 'Người nhận quay 1 lần duy nhất, bạn biết họ trúng quà gì' },
  { id: 'cau-do', emoji: '💯', name: 'Bạn hiểu tớ bao nhiêu?', desc: 'Câu đố về hai bạn, chấm điểm, bạn xem được từng câu trả lời' },
];

export const GAME_LIMITS = { prizes: 6, minPrizes: 2, prize: 40, questions: 5, question: 80, options: 4, minOptions: 2, option: 30 };

export const DEFAULT_PRIZES = ['1 ly trà sữa 🧋', '1 buổi xem phim 🎬', 'Ôm 10 phút 🫂', '1 bữa lẩu 🍲', 'Được chiều cả ngày 👑', '1 điều ước bất kỳ ✨'];

export const DEFAULT_QUIZ = [
  { q: 'Mình gặp nhau lần đầu ở đâu?', options: ['Ở trường', 'Quán cà phê', 'Trên mạng', 'Chỗ làm'], answer: 0 },
  { q: 'Món tớ mê nhất là gì?', options: ['Lẩu', 'Bún bò', 'Trà sữa', 'Gà rán'], answer: 2 },
  { q: 'Tớ thích cậu ở điểm nào nhất?', options: ['Nụ cười', 'Sự tử tế', 'Giọng nói', 'Tất cả luôn'], answer: 3 },
];

export const defaultGame = () => ({ id: '', prizes: [...DEFAULT_PRIZES], quiz: DEFAULT_QUIZ.map((x) => ({ ...x, options: [...x.options] })) });

/** Nhận xét theo điểm câu đố (dùng cả trên thiệp và trang quản lý). */
export function quizVerdict(score, total) {
  const r = total ? score / total : 0;
  if (r === 1) return 'Hiểu tớ hơn cả tớ luôn 😳💯';
  if (r >= 0.6) return 'Hiểu tớ phết đấy 😚';
  if (r > 0) return 'Cần tìm hiểu tớ thêm nha 🤭';
  return 'Ơ kìa… phải đi chơi với tớ nhiều hơn rồi 😤';
}
