# Dự án: App Thiệp Tương Tác (tên tạm: TEN_APP)

Bạn là kỹ sư full-stack làm việc cùng chủ dự án (một sinh viên, không chuyên code). Hãy xây web app tạo **thiệp và lời nhắn tương tác** dạng link, bán theo lượt qua QR ngân hàng (SePay). Mục tiêu: ra mắt trước **10/10/2026** để bán mùa 20/10.

Giao tiếp với chủ dự án bằng **tiếng Việt, ngắn gọn, không thuật ngữ khó**. Toàn bộ chữ trên giao diện bằng tiếng Việt có dấu, giọng thân thiện, trẻ trung.

---

## 1. Ràng buộc bắt buộc

- **Chi phí vận hành 0đ.** Chỉ dùng gói miễn phí:
  - Cloudflare Pages (giao diện tĩnh) + Pages Functions (API) + Cloudflare D1 (cơ sở dữ liệu, lưu cả ảnh).
  - Không dùng R2, KV, Cron Triggers, dịch vụ trả phí hay API AI nào khi app chạy.
  - Địa chỉ: `TEN_APP.pages.dev` (chưa có tên miền riêng).
- **Giới hạn gói miễn phí cần tôn trọng:**
  - Workers/Functions: 100.000 request/ngày, khoảng 10ms CPU mỗi request. Không xử lý ảnh trên server; mọi việc nặng (nén ảnh, tạo QR) làm trên trình duyệt.
  - D1: 5GB tổng, 100.000 dòng ghi/ngày, 5 triệu dòng đọc/ngày.
  - SePay: 50 giao dịch/tháng ở gói miễn phí.
- **Mobile-first.** 90% người dùng mở bằng điện thoại, qua trình duyệt trong Zalo, Messenger, TikTok. Phải chạy mượt ở các trình duyệt nhúng này.
- **Nhẹ:** trang thiệp tải dưới 2 giây trên 4G. JavaScript mỗi trang dưới 150KB, không framework nặng.
- **Đơn giản để bảo trì:** HTML, CSS, JavaScript thuần (ES modules), không bước build phức tạp. Phía server dùng TypeScript hoặc JavaScript trong thư mục `functions/` của Pages. Được phép dùng thư viện nhỏ qua npm nếu thật cần (ví dụ `qrcode` để tạo mã QR của link thiệp).

## 2. Sản phẩm

### Hai vai
- **Người tạo** (trả tiền): chọn mẫu, điền thông tin, tải ảnh, xem trước miễn phí, quét QR thanh toán, nhận link.
- **Người nhận** (miễn phí): mở link, xem thiệp. Cuối thiệp có nút nhỏ "Tạo thiệp của bạn" dẫn về trang chủ (vòng lặp lan truyền).

### 4 mẫu thiệp (mỗi mẫu phải có một khoảnh khắc "wow" đáng quay video)
1. **`phu-nu-2010`, "Gửi người phụ nữ đặc biệt" (20/10):** màn hình phong bì, chạm để mở → hoa rơi nhẹ → ảnh trình chiếu (1–10 ảnh) → lời chúc hiện từng chữ như đang gõ → chữ ký người gửi. Có biến thể giọng văn cho: mẹ, người yêu/vợ, cô giáo, bạn thân, đồng nghiệp.
2. **`to-tinh`, "Làm người yêu tớ nhé?":** câu hỏi lớn, nút "Có" và "Không". Nút "Không" bỏ chạy khi chạm hoặc rê chuột tới (luôn nằm trong màn hình). Mỗi lần né, nút "Có" to thêm một chút. Bấm "Có" → pháo hoa → ảnh và lời nhắn bí mật hiện ra.
3. **`xin-loi`, "Tha lỗi cho tớ nhé":** nút "Không tha" nhỏ dần qua mỗi lần bấm rồi biến mất, chữ trên nút đổi theo ("Thật không?", "Nghĩ lại đi mà"...). Bấm "Tha" → hiệu ứng trái tim → lời nhắn.
4. **`di-choi` (giai đoạn sau, chỉ làm nếu còn thời gian):** "Đi chơi với tớ không?", người nhận chọn ngày và món ăn, người tạo xem được câu trả lời ở trang quản lý.

Người tạo có thể sửa mọi câu chữ trên thiệp (câu hỏi, chữ trên nút, lời nhắn). Có sẵn câu mặc định hay.

### Thư viện lời chúc (thay cho AI)
Tạo `public/data/loi-chuc.json`: khoảng 90 lời chúc tiếng Việt **tự nhiên, cảm động, không sáo rỗng**, chia theo mẫu thiệp và mối quan hệ (mẹ, người yêu, vợ, cô giáo, bạn thân, đồng nghiệp, crush), mỗi nhóm 6–10 lời, độ dài 2–5 câu. Có chỗ chèn `{ten}` (tên người nhận). Nút "Gợi ý lời chúc" lấy ngẫu nhiên 3 lời phù hợp.

### Nhạc nền
5 file `public/music/nhac-1.mp3` … `nhac-5.mp3` (chủ dự án tự tải từ Pixabay Music). Trong lúc chờ, dùng file im lặng làm chỗ trống và ghi chú trong README. Nhạc chỉ phát sau khi người nhận chạm vào màn hình (quy định autoplay của trình duyệt), có nút tắt/bật.

### Bảng giá

| Gói | Giá | Ảnh tối đa | Link tồn tại | Thêm |
|---|---|---|---|---|
| Xem thử | 0đ | 10 | Không có link, chỉ xem trước có watermark | |
| Cơ bản | 15.000đ | 3 | 30 ngày | Bỏ watermark |
| Đặc biệt | 29.000đ | 10 | 365 ngày | Sửa lời nhắn sau khi gửi, mã QR của link để in kèm quà |

Để giá trong một file cấu hình (`functions/_lib/config.ts` hoặc tương tự) để dễ đổi. Gói "Combo 20/10" (49k = 3 thiệp) để giai đoạn sau.

## 3. Các trang

| Đường dẫn | Mục đích |
|---|---|
| `/` | Trang chủ: tiêu đề hấp dẫn, 4 mẫu với ảnh động xem thử, bảng giá, câu hỏi thường gặp |
| `/tao?mau=<mẫu>` | Trình tạo 3 bước: (1) thông tin người nhận và mối quan hệ, (2) lời nhắn + gợi ý + ảnh, (3) nhạc nền. Nút "Xem trước" luôn hiện |
| `/xem-truoc` | Xem trước toàn màn hình, có watermark chéo mờ "Bản xem thử". **Chạy hoàn toàn trên trình duyệt**, ảnh dùng blob URL, chưa tải gì lên server |
| `/thanh-toan/<maDon>` | Chọn gói, hiện QR, tự động chuyển sang trang thành công khi tiền về |
| `/t/<slug>` | Trang thiệp cho người nhận |
| `/quan-ly/<slug>#<editToken>` | Trang quản lý của người tạo: copy link, tải QR của link, sửa lời nhắn (gói Đặc biệt), xem số lượt mở |
| `/admin` | Trang quản trị cho chủ dự án (đăng nhập bằng mật khẩu trong biến môi trường) |
| `/dieu-khoan`, `/ho-tro` | Điều khoản sử dụng ngắn gọn; trang hỗ trợ có Zalo của chủ dự án (để biến cấu hình) |

Bản nháp trong trình tạo được lưu tự động vào IndexedDB (cả ảnh), để người dùng lỡ đóng tab vẫn làm tiếp được.

## 4. Luồng thanh toán SePay

1. Người tạo bấm "Lấy link thiệp" → chọn gói → trình duyệt **nén ảnh** (cạnh dài tối đa 1280px, JPEG/WebP chất lượng khoảng 0.8, mỗi ảnh dưới 300KB) → gửi thiệp và ảnh lên `POST /api/cards` → server lưu thiệp trạng thái `draft`, tạo đơn và trả về `orderCode`.
2. **Mã đơn:** `TX` + 4 ký tự từ bảng `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, duy nhất, không dấu.
3. **QR:** `<img src="https://vietqr.app/img?acc=<SEPAY_ACC>&bank=<SEPAY_BANK>&amount=<số tiền>&des=<orderCode>&template=compact">`. Hiện kèm số tiền, số tài khoản, nội dung chuyển khoản (có nút sao chép) cho ai không quét được. Đơn hết hạn sau 30 phút.
4. Trang thanh toán hỏi `GET /api/orders/<orderCode>` mỗi 3 giây (dừng khi tab ẩn, tiếp tục khi hiện lại). Khi `status = paid` → chuyển sang trang thành công: link thiệp, nút sao chép, nút chia sẻ, QR của link, **link quản lý** (nhắc lưu lại).
5. **Webhook `POST /api/sepay-webhook`:**
   - Chỉ chấp nhận khi header `Authorization` đúng bằng `Apikey <SEPAY_WEBHOOK_KEY>` (so sánh an toàn thời gian). Sai → trả 401.
   - Chỉ xử lý `transferType === "in"`.
   - Tìm mã đơn trong `code` hoặc `content` bằng regex `/TX[A-Z2-9]{4}/i` (ngân hàng có thể đổi chữ hoa/thường hoặc thêm ký tự).
   - **Chống xử lý trùng:** lưu `id` giao dịch SePay vào bảng `payments` (khóa duy nhất). Đã có thì trả `{"success": true}` và bỏ qua.
   - `transferAmount >= amount` của đơn → đánh dấu đơn `paid`, thiệp `active`, đặt `expires_at` theo gói. Thiếu tiền hoặc không khớp mã → lưu vào `payments` với trạng thái `needs_review` để chủ dự án xử lý tay ở `/admin`.
   - Luôn trả JSON `{"success": true}` khi đã ghi nhận (kể cả `needs_review`) để SePay không gửi lại mãi.
6. Biến môi trường (secret): `SEPAY_WEBHOOK_KEY`, `SEPAY_ACC`, `SEPAY_BANK`, `ADMIN_PASSWORD`, `SUPPORT_ZALO`.

## 5. Dữ liệu (D1)

Thiết kế bảng (có thể chỉnh nếu có lý do, nhưng giải thích):
- `cards`: id, slug (8 ký tự ngẫu nhiên, khó đoán), template, data_json (tên, lời nhắn, câu chữ tùy chỉnh, nhạc…), plan, status (`draft` | `active` | `expired` | `removed`), edit_token_hash, views, created_at, expires_at.
- `card_images`: card_id, idx, mime, data (BLOB). Phục vụ qua `GET /api/img/<slug>/<idx>`, header cache dài, chỉ trả khi thiệp `active` (hoặc `draft` kèm mã đơn hợp lệ).
- `orders`: code, card_id, plan, amount, status (`pending` | `paid` | `expired`), created_at, paid_at.
- `payments`: sepay_id (unique), order_code, amount, content, status (`matched` | `needs_review`), raw_json, created_at.
- `reports`: id, card_id, reason, created_at.
- `rate_limits`: key, count, window_start (giới hạn tạo đơn theo IP: tối đa 10 đơn/giờ).

Có file migration SQL trong `migrations/`.

**Dọn dẹp không dùng cron:** mỗi lần tạo đơn mới, xóa tối đa 5 thiệp `draft` cũ hơn 24 giờ (kèm ảnh) và chuyển các thiệp hết hạn sang `expired` (xóa ảnh để tiết kiệm dung lượng).

## 6. Bảo mật và nội dung

- **Chống XSS tuyệt đối:** mọi chữ người dùng nhập chỉ được gán bằng `textContent`, không bao giờ `innerHTML`. Có header CSP chặt cho trang thiệp.
- Kiểm tra ở server: kích thước từng ảnh (≤ 350KB), loại file (jpeg/png/webp theo magic bytes), số ảnh theo gói, độ dài từng trường chữ.
- Lọc từ ngữ thô tục tiếng Việt cơ bản trong lời nhắn (danh sách trong file cấu hình).
- Trang `/t/*`: `<meta name="robots" content="noindex">` và header `X-Robots-Tag: noindex`.
- Nút "Báo cáo thiệp" nhỏ trên mọi thiệp.
- `editToken` chỉ nằm trong phần `#` của link quản lý; server chỉ lưu bản băm.
- Trang `/admin`: đăng nhập bằng mật khẩu, cookie HttpOnly. Hiện doanh thu hôm nay/tuần, đơn mới nhất, danh sách `needs_review` (nút "Kích hoạt thủ công"), báo cáo, nút gỡ thiệp.

## 7. Thiết kế giao diện

- Cảm giác: ấm áp, lãng mạn, hiện đại, không sến. Mỗi mẫu thiệp có bảng màu riêng. Tránh gradient tím-xanh phổ biến.
- Font Google hỗ trợ tiếng Việt tốt (ví dụ Be Vietnam Pro cho chữ thường, một font viết tay có dấu tiếng Việt cho lời chúc; kiểm tra kỹ dấu tiếng Việt hiển thị đúng).
- Hiệu ứng bằng CSS và canvas nhẹ. Tôn trọng `prefers-reduced-motion`.
- Nút lớn, dễ bấm bằng ngón cái. Kiểm tra ở chiều rộng 360px.
- Trang chủ cần có ảnh động hoặc video ngắn demo từng mẫu (có thể là bản thu màn hình làm sau; lúc đầu dùng bản xem trước chạy trực tiếp).

## 8. Cách làm việc

Làm theo **4 giai đoạn**. **Sau mỗi giai đoạn, dừng lại**, tóm tắt cho chủ dự án bằng 3–5 gạch đầu dòng dễ hiểu và hướng dẫn họ thử (lệnh cần chạy, link cần mở). Chỉ làm tiếp khi được đồng ý.

1. **Khung và một mẫu hoàn chỉnh:** cấu trúc dự án, D1 + migration, trang chủ đơn giản, trình tạo, xem trước, mẫu `to-tinh` hoàn chỉnh, trang thiệp `/t/<slug>`. Chạy được bằng `npx wrangler pages dev`.
2. **Thanh toán:** tạo đơn, trang QR, webhook SePay, hỏi trạng thái, trang thành công, trang quản lý. Kèm script `scripts/gia-lap-webhook.sh` (curl) để giả lập SePay báo tiền về khi thử ở máy.
3. **Đủ mẫu và nội dung:** mẫu `phu-nu-2010`, `xin-loi`, thư viện lời chúc, nhạc nền, trang chủ đầy đủ, điều khoản, hỗ trợ.
4. **Quản trị, hoàn thiện, đưa lên mạng:** `/admin`, báo cáo, dọn dẹp, kiểm tra trên điện thoại, hướng dẫn deploy từng bước (tạo D1 trên Cloudflare, chạy migration, đặt secret, deploy, cấu hình webhook SePay trỏ tới `https://TEN_APP.pages.dev/api/sepay-webhook`).

Yêu cầu chung:
- Viết test tự động cho phần quan trọng nhất: tìm mã đơn trong nội dung chuyển khoản, xử lý webhook (đúng khóa, sai khóa, trùng giao dịch, thiếu tiền), tính ngày hết hạn.
- Tạo `README.md` bằng tiếng Việt: cách chạy ở máy, cách deploy, cách đổi giá, cách thêm mẫu thiệp mới cho dịp lễ sau.
- Không bao giờ đưa secret vào code hay git. Dùng `.dev.vars` (đã có trong `.gitignore`) khi chạy ở máy.
- Nếu một yêu cầu ở đây mâu thuẫn hoặc không làm được trong gói miễn phí, dừng lại và hỏi thay vì tự ý đổi.
