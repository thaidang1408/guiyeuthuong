-- File ghi âm/ghi hình gắn với thiệp:
--   kind = 'voice'    lời nhắn giọng nói người tạo ghi (tải lên cùng thiệp)
--   kind = 'reaction' video phản ứng người nhận tự đồng ý quay và gửi
-- Một ô BLOB của D1 chứa tối đa khoảng 2MB nên file được cắt thành nhiều phần (part = 0, 1, 2…).
CREATE TABLE card_media (
  card_id    INTEGER NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
  kind       TEXT    NOT NULL,
  part       INTEGER NOT NULL,
  mime       TEXT    NOT NULL,
  data       BLOB    NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (card_id, kind, part)
);

-- "Mở cùng nhau": lần gần nhất mỗi bên báo "sẵn sàng" (side = 'gui' người tạo, 'nhan' người nhận).
CREATE TABLE card_presence (
  card_id INTEGER NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
  side    TEXT    NOT NULL,
  seen_at INTEGER NOT NULL,
  PRIMARY KEY (card_id, side)
);

-- "Sổ tình yêu chung": các trang kỷ niệm hai người viết thêm sau khi thiệp đã gửi.
CREATE TABLE card_memories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id    INTEGER NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
  author     TEXT    NOT NULL,
  text       TEXT    NOT NULL,
  mime       TEXT,
  image      BLOB,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_card_memories_card ON card_memories (card_id, created_at);
