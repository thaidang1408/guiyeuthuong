-- Combo 20/10: mỗi đơn lưu bản băm "mã combo" (tính từ mã sửa thiệp) và số lượt đã dùng.
-- Mã chỉ có tác dụng khi đơn là gói "combo" và đã thanh toán.
ALTER TABLE orders ADD COLUMN combo_code_hash TEXT;
ALTER TABLE orders ADD COLUMN combo_used INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX idx_orders_combo ON orders (combo_code_hash);

-- Mẫu "Đi chơi với tớ không?": câu trả lời của người nhận (ngày, món, lời nhắn).
CREATE TABLE card_responses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id     INTEGER NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
  answer_json TEXT    NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_card_responses_card ON card_responses (card_id, created_at);
