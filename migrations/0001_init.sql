-- Khởi tạo cơ sở dữ liệu. Mọi mốc thời gian lưu dạng số mili-giây (Date.now()).

CREATE TABLE cards (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  slug            TEXT    NOT NULL UNIQUE,
  template        TEXT    NOT NULL,
  data_json       TEXT    NOT NULL,
  plan            TEXT    NOT NULL,
  status          TEXT    NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'active', 'expired', 'removed')),
  edit_token_hash TEXT    NOT NULL,
  views           INTEGER NOT NULL DEFAULT 0,
  -- Thêm so với thiết kế gốc: lưu sẵn số ảnh để trang thiệp không phải đếm bảng card_images.
  image_count     INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL,
  expires_at      INTEGER
);
CREATE INDEX idx_cards_status_created ON cards (status, created_at);
CREATE INDEX idx_cards_status_expires ON cards (status, expires_at);

CREATE TABLE card_images (
  card_id INTEGER NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
  idx     INTEGER NOT NULL,
  mime    TEXT    NOT NULL,
  data    BLOB    NOT NULL,
  PRIMARY KEY (card_id, idx)
);

CREATE TABLE orders (
  code       TEXT    PRIMARY KEY,
  card_id    INTEGER NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
  plan       TEXT    NOT NULL,
  amount     INTEGER NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending', 'paid', 'expired')),
  created_at INTEGER NOT NULL,
  paid_at    INTEGER
);
CREATE INDEX idx_orders_card ON orders (card_id);
CREATE INDEX idx_orders_status_created ON orders (status, created_at);

CREATE TABLE payments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  sepay_id   TEXT    NOT NULL UNIQUE,
  order_code TEXT,
  amount     INTEGER NOT NULL,
  content    TEXT,
  status     TEXT    NOT NULL CHECK (status IN ('matched', 'needs_review')),
  raw_json   TEXT    NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_payments_status ON payments (status, created_at);

CREATE TABLE reports (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id    INTEGER NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
  reason     TEXT    NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_reports_card ON reports (card_id);

CREATE TABLE rate_limits (
  key          TEXT    PRIMARY KEY,
  count        INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);
