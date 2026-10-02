-- Nhạc người tạo tự tải lên. Một ô BLOB của D1 chứa tối đa khoảng 2MB,
-- nên bài nhạc được cắt thành nhiều phần (part = 0, 1, 2…) rồi ghép lại khi phát.
CREATE TABLE card_music (
  card_id INTEGER NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
  part    INTEGER NOT NULL,
  mime    TEXT    NOT NULL,
  data    BLOB    NOT NULL,
  PRIMARY KEY (card_id, part)
);
