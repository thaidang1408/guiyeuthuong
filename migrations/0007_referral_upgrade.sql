-- (Không còn dùng) Cột ref từng dành cho mã cộng tác viên; tính năng đã gỡ, cột để trống vô hại.
ALTER TABLE orders ADD COLUMN ref TEXT;
CREATE INDEX idx_orders_ref ON orders (ref, status) WHERE ref IS NOT NULL;
-- Đơn nâng cấp (plan = 'nang-cap') dùng lại bảng orders, không cần bảng mới.
