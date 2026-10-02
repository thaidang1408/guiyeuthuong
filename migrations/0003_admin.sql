-- Trang quản trị: đánh dấu giao dịch "cần xem" và báo cáo đã xử lý xong (để ẩn khỏi danh sách).
ALTER TABLE payments ADD COLUMN resolved_at INTEGER;
ALTER TABLE reports ADD COLUMN resolved_at INTEGER;
-- Tính doanh thu theo ngày nhanh hơn.
CREATE INDEX idx_orders_paid_at ON orders (paid_at);
