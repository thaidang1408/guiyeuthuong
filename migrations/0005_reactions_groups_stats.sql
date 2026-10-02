-- Phản ứng của người nhận, để người tạo xem ở trang quản lý:
-- lần đầu/lần gần nhất mở thiệp, lúc bấm "Có"/"Tha"…, số lần bấm "Không", thời gian suy nghĩ.
ALTER TABLE cards ADD COLUMN first_opened_at INTEGER;
ALTER TABLE cards ADD COLUMN last_opened_at INTEGER;
ALTER TABLE cards ADD COLUMN yes_at INTEGER;
ALTER TABLE cards ADD COLUMN no_presses INTEGER;
ALTER TABLE cards ADD COLUMN think_ms INTEGER;

-- Thiệp nhóm: bản băm của "link mời ký tên" (tính từ mã sửa, giống mã combo).
ALTER TABLE cards ADD COLUMN invite_hash TEXT;

CREATE TABLE card_signatures (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id    INTEGER NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  message    TEXT    NOT NULL,
  sticker    TEXT    NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_card_signatures_card ON card_signatures (card_id, created_at);

-- Số liệu tổng (đếm sẵn để trang chủ chỉ đọc 1 dòng thay vì đếm cả bảng).
CREATE TABLE stats (
  key   TEXT    PRIMARY KEY,
  value INTEGER NOT NULL
);
INSERT INTO stats (key, value) VALUES ('cards_sent', (SELECT COUNT(*) FROM orders WHERE status = 'paid'));
