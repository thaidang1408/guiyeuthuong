# Gửi Yêu Thương — Thiệp tương tác gửi bằng link

Web app tạo thiệp và lời nhắn tương tác (tỏ tình, xin lỗi, 20/10…), bán theo lượt qua QR ngân hàng (SePay).
Chạy hoàn toàn trên gói miễn phí của Cloudflare: Pages + Pages Functions + D1.

> **Tiến độ:** Đủ 4 giai đoạn + mở rộng: 8 mẫu thiệp (20/10, thiệp nhóm, muốn ở cạnh em, sinh nhật, tỏ tình, xin lỗi, thư Mở khi…, đi chơi), Combo 20/10, khóa câu hỏi bí mật, biên lai chia sẻ, thư đáp lại, phản ứng người nhận, QR trái tim, 154 lời chúc, trang miễn phí (đếm ngày yêu, chữ rơi), trang quản trị.

---

## 1. Chạy ở máy

Cần cài [Node.js](https://nodejs.org) bản 22 trở lên.

```bash
npm install                 # cài công cụ (chỉ lần đầu)
npm run cau-hinh            # nhập ngân hàng + số tài khoản, tạo file .dev.vars (chỉ lần đầu)
npm run db:migrate:local    # tạo cơ sở dữ liệu ở máy (chỉ lần đầu, hoặc khi có migration mới)
npm run dev                 # chạy web
```

Mở <http://localhost:8788>.

- `npm test` — chạy test tự động.
- `npm run gia-lap -- <mã đơn>` — giả lập SePay báo "tiền đã về" (xem mục dưới).
- `npm run typecheck` — kiểm tra lỗi kiểu TypeScript ở phần server.

**Mẹo thử trên điện thoại thật:** điện thoại và máy tính cùng mạng Wi-Fi, chạy `npx wrangler pages dev --ip 0.0.0.0`,
rồi mở `http://<IP máy tính>:8788` trên điện thoại.

### Thử thanh toán ở máy (không cần chuyển tiền thật)

**Cách nhanh nhất:** trên trang QR, kéo xuống cuối có khung **"🧪 Chế độ thử"** với hai nút
"Giả lập tiền về đủ" và "Giả lập chuyển thiếu". Giao dịch giả đi qua đúng đường xử lý của SePay thật.
Khung này chỉ hiện khi `DEV_SIMULATE_PAYMENT=1` **và** đang chạy ở máy — trên Cloudflare nó luôn tắt.

**Hoặc dùng terminal** (thử thêm trường hợp sai khóa):

1. Tạo thiệp, chọn gói → trang QR hiện ra với mã đơn dạng `TXAB23`. Để nguyên trang đó.
2. Mở một terminal khác, chạy:
   ```bash
   npm run gia-lap -- TXAB23            # chuyển đủ tiền → trang QR tự chuyển sang "Thiệp đã sẵn sàng"
   npm run gia-lap -- TXAB23 10000      # chuyển thiếu → đơn chờ duyệt tay, thiệp chưa mở được
   npm run gia-lap -- TXAB23 15000 sai  # khóa sai → bị từ chối (401)
   ```
   Có cả bản bash: `bash scripts/gia-lap-webhook.sh TXAB23 15000`.

### Thử với SePay và tài khoản ngân hàng thật

SePay cần gọi được tới máy bạn qua internet, nên ta mở một "đường hầm" miễn phí của Cloudflare (không cần tài khoản):

1. Đăng ký [SePay](https://my.sepay.vn) (gói miễn phí: 50 giao dịch/tháng) và liên kết tài khoản ngân hàng.
2. `npm run cau-hinh` → nhập tên ngân hàng, số tài khoản đã liên kết SePay. Script tự tạo khóa webhook và in ra.
3. `npm run dev`, đợi dòng `Ready on …`, rồi **bấm phím `t`** trong terminal đó (lần đầu wrangler hỏi tải công cụ `cloudflared` → đồng ý).
   Chờ vài giây sẽ hiện địa chỉ dạng `https://abc-xyz.trycloudflare.com`.
4. Trên SePay → **WebHooks → Thêm webhook**:
   - Sự kiện: *Có tiền vào*
   - URL: `https://abc-xyz.trycloudflare.com/api/sepay-webhook`
   - Kiểu chứng thực: *API Key*, giá trị: khóa mà `npm run cau-hinh` đã in (cũng nằm trong `.dev.vars`, dòng `SEPAY_WEBHOOK_KEY`)
   - "Bỏ qua nếu nội dung không có Code thanh toán": chọn *Không*
   - Thêm nữa, trong **Cấu hình công ty → Cấu trúc mã thanh toán**: tiền tố `TX`, phần sau 4 ký tự chữ + số.
     Thiếu bước này SePay không nhận ra mã đơn (trường `code` trống) và có thể **không gửi webhook**.
5. Mở web qua địa chỉ trycloudflare (hoặc localhost), tạo thiệp, chọn gói Cơ bản, rồi **chuyển 15.000đ thật** từ một tài khoản/ví khác
   bằng cách quét QR. Vài giây sau trang QR tự chuyển sang "Thiệp đã sẵn sàng". Tiền vẫn vào tài khoản của bạn.

**Đối soát dự phòng bằng API (nên bật):** nhập *API Access* của SePay khi chạy `npm run cau-hinh`
(biến `SEPAY_API_TOKEN`). Khi trang thanh toán đang chờ, server tự hỏi SePay "có tiền mới không" (tối đa 10 giây/lần, chung cho cả hệ thống),
nên webhook có trục trặc thì thiệp vẫn được kích hoạt. Giao dịch được chống trùng theo mã giao dịch SePay, không bao giờ tính hai lần.
Chỉ giao dịch có mã đơn `TX…` mới được xét; tiền cá nhân khác trong tài khoản không bị đụng tới.

Lưu ý: địa chỉ trycloudflare **đổi mỗi lần** bấm `t`, nên mỗi lần thử phải sửa lại URL webhook trên SePay.
Khi đưa lên mạng (giai đoạn 4) sẽ dùng địa chỉ cố định `https://guiyeuthuong.pages.dev/api/sepay-webhook`.
Giao dịch thật lúc thử ở máy chỉ ghi vào cơ sở dữ liệu trên máy bạn.

### Nhạc nền
Thư mục `public/music/` đang chứa 5 file **im lặng** làm chỗ trống (`nhac-1.mp3` … `nhac-5.mp3`).
Tải 5 bản nhạc từ [Pixabay Music](https://pixabay.com/music/) (miễn phí, dùng thương mại được, không cần ghi nguồn), đổi tên đúng như trên và chép đè vào.
Gợi ý (đã kiểm tra ngày 01/10/2026, bấm nút **Download** trên mỗi trang):

| File | Tâm trạng | Bài |
|---|---|---|
| `nhac-1.mp3` | Nhẹ nhàng (mặc định mẫu 20/10) | [Moment of Peace – MickeysCat](https://pixabay.com/music/solo-piano-moment-of-peace-mickeyscat-554494/) |
| `nhac-2.mp3` | Ngọt ngào (mặc định mẫu tỏ tình) | [Once In Paris – Pumpupthemind](https://pixabay.com/music/beats-once-in-paris-168895/) |
| `nhac-3.mp3` | Vui tươi | [A Small Miracle – Romarecord1973](https://pixabay.com/music/acoustic-group-a-small-miracle-132333/) |
| `nhac-4.mp3` | Lãng mạn (lofi) | [Good Night – Lofi Cozy Chill – FASSounds](https://pixabay.com/music/beats-good-night-lofi-cozy-chill-music-160166/) |
| `nhac-5.mp3` | Sâu lắng (mặc định mẫu xin lỗi) | [Sad Emotional – leberch](https://pixabay.com/music/modern-classical-sad-emotional-509537/) |

Nên dưới 1.5MB để thiệp tải nhanh. Đổi tên hiển thị của nhạc trong `public/js/shared/templates.js` (mục `MUSIC`).
Không dùng nhạc V-pop/nhạc hot trên TikTok làm nhạc có sẵn: các bài đó có bản quyền, app bán tiền mà phát chúng là vi phạm.

**Nhạc của bạn:** ở bước 3, người tạo có thể tải bài nhạc của họ lên (MP3/M4A/OGG, tối đa 4MB, đổi ở
`public/js/shared/audio.js`). Nhạc lưu trong D1 (bảng `card_music`), bị xóa khi thiệp hết hạn.
Muốn tạo lại file im lặng: `node scripts/tao-nhac-im-lang.mjs --ghi-de`.
Có file migration mới (ví dụ `0002_card_music.sql`) thì chạy `npm run db:migrate:local` ở máy; `npm run deploy` tự chạy migration trên mạng.

---

## Tính năng lan truyền (đọc nhanh)

| Tính năng | Ở đâu trong code |
|---|---|
| Biên lai tình yêu (ảnh để chia sẻ story) | `js/core/receipt.js`, hàm `receipt()` trong từng mẫu |
| Người tạo xem phản ứng (mở lúc nào, né "Không" mấy lần) | `api/phan-ung`, trang quản lý |
| Thư đáp lại của người nhận | `api/dap-lai`, `js/card/end-panel.js` |
| Khóa câu hỏi bí mật + dấu niêm phong | `js/shared/lock.js`, `js/card/lock-screen.js` |
| Thẻ cào bí mật | `js/core/scratch.js` (mẫu tỏ tình, xin lỗi) |
| Thiệp nhóm: link mời ký tên `/ky/<slug>#<mã>` | `services/group-service.ts`, `js/pages/ky.js` |
| Thư "Mở khi…" khóa theo ngày (server giấu nội dung tới đúng ngày) | `domain/letters.ts` |
| QR trái tim để in kèm quà | `js/core/link-qr.js` |
| Số thiệp đã gửi trên trang chủ (số thật, hiện khi ≥ 50) | bảng `stats`, `STATS_MIN` trong `js/pages/home.js` |
| Trang miễn phí kéo khách từ Google | `/dem-ngay-yeu`, `/chu-roi`, `sitemap.xml` |
| Hiệu ứng: pháo hoa trái tim, pháo giấy, lấp lánh theo ngón tay, nền ánh sáng | `js/core/fireworks.js`, `confetti.js`, `ambient.js` |

**Giá ra mắt** (đang tắt): trong `public/js/shared/plans.js`, đặt `PROMO.until` và thêm `listPrice` cho gói.
Chỉ bật khi thật sự sẽ tăng giá sau ngày đó (hiện giá gạch giả là vi phạm luật bảo vệ người tiêu dùng).


### Tính năng "tiên phong" (bảng ở `migrations/0006_…sql`, code ở `functions/_lib/services/extras-service.ts`)

| Tính năng | Người tạo bật ở đâu | Người nhận thấy gì | Người tạo xem ở trang quản lý |
|---|---|---|---|
| 🎙️ Lời nhắn giọng nói | Bước 2, "Bấm để ghi âm" (tối đa 60 giây) | Ô phát có sóng âm nhảy theo giọng, nhạc nền tự nhỏ lại | Nghe lại |
| ⏰ Hẹn giờ mở | Bước 3 → "Tuỳ chọn đặc biệt" | Đồng hồ đếm ngược; **server không gửi nội dung/ảnh** trước giờ mở | Giờ mở |
| 💞 Mở cùng nhau | Bước 3 → "Tuỳ chọn đặc biệt" | Hai trái tim, cả hai bấm "Sẵn sàng" → cùng đếm 3-2-1 rồi mở | Nút "Mở phía của mình" |
| 📹 Quay phản ứng | Bước 3 → "Tuỳ chọn đặc biệt" | Hỏi đồng ý → quay 15 giây → **tự xem lại, tự chọn gửi hay xóa** | Xem/lưu video |
| 📔 Sổ tình yêu chung | Mẫu `so-tay` | Cả hai viết thêm trang (chữ + 1 ảnh) bất cứ lúc nào | Xem/xóa từng trang |

Lưu ý:
- Video phản ứng chỉ người có link quản lý xem được; người nhận không bấm "Gửi" thì không có gì rời khỏi máy họ.
- "Mở cùng nhau": hai máy hỏi server mỗi 2 giây (dừng sau 15 phút). Chờ quá 3 phút thì người nhận được chọn mở một mình.
- iPhone ghi âm/quay ra MP4, Android ra WebM; Safari đời cũ có thể không phát được WebM — nên thử trên máy thật.
- Ảnh xem trước khi gửi link: `public/img/og-thiep.jpg` (thiệp) và `og-home.jpg` (trang chủ); tiêu đề có tên người nhận.
- Trang `/admin` có đồng hồ "Giao dịch SePay tháng này: x/50" — vàng khi ≥ 40, đỏ khi hết lượt (đổi số ở `SEPAY_MONTHLY_LIMIT` trong `functions/_lib/config.ts`).
- Cuối mỗi thiệp có nút "💌 Gửi lại một tấm cho …": trang tạo thiệp tự điền sẵn tên (đổi vai người gửi/người nhận).

### Mẫu "Chuyện tình của tụi mình" (`chuyen-tinh`, cho hai người đang yêu / vợ chồng)

Kể chuyện tình như story Instagram/TikTok: tiêu đề → đếm số ngày bên nhau (nếu điền ngày yêu) → mỗi dòng
"kỷ niệm" thành một trang kèm ảnh theo thứ tự (chạm phải để tới, trái để lùi, tự chuyển sau 5,5 giây) → lời hứa:
người nhận giữ tay vào nút 🤙 để "móc ngoéo" → pháo hoa → lá thư. Trang quản lý ghi "Đã móc ngoéo hứa với bạn".
Code: `public/js/templates/chuyen-tinh.js`, `public/css/templates/chuyen-tinh.css`.

### Thiệp hiệu ứng (4 mẫu riêng)

Mở link là chạy ngay một hiệu ứng toàn màn hình, xong hiện lời nhắn + chữ ký, có nút "Xem lại hiệu ứng".
Khai báo trong `public/js/shared/templates.js` (trường `effect`), khung chung `public/js/templates/hieu-ung.js`,
css chung `public/css/templates/hieu-ung.css`, code hiệu ứng ở `public/js/fx/`.

| Mẫu (`mau=`) | Hiệu ứng (`fx/…`) | Người nhận làm gì |
|---|---|---|
| `vu-tru` 🌌 Vũ trụ của tụi mình | `thien-ha` | Thiên hà 3D, tên/các câu nhỏ/ảnh bay quanh, kéo để xoay |
| `tim-sang` 💗 Trái tim nghìn hạt sáng | `tim-hat` | Trái tim hạt đập theo nhịp, chạm tạo sóng |
| `ten-sao` ✨ Tên người ấy bằng ngàn vì sao | `ten-sao` | Sao tụ thành tên, rồi thành trái tim; vuốt là sao tung ra |
| `tim-anh` 🖼️ Trái tim kỷ niệm | `tim-anh` | Ảnh bay vào xếp thành trái tim đang đập, chạm để xem to |

Thiệp hiệu ứng chỉ cho thêm màn mở đầu và trò chơi (server tự bỏ màn kết/nền). Các mẫu thiệp thường không còn chọn
"màn kết" nữa; thiệp cũ đã gắn màn kết vẫn hiện nút "Còn một bất ngờ nữa…" như trước.

Xem thử nhanh: `/xem-truoc?hieu-ung=thien-ha` (có ô điền tên, bấm "Tạo thiệp này" là vào `/tao?mau=vu-tru` với tên điền sẵn),
`/xem-truoc?demo=vu-tru`.

### Âm thanh hiệu ứng (`public/js/core/sfx.js`)

Tiếng "ting", "bùm" pháo hoa, nhịp tim "thình thịch", hộp quà lục cục, nút "Không" kêu "bóing"… được tạo trực tiếp
bằng Web Audio, không cần file âm thanh, không tốn dung lượng. Chỉ kêu sau lần chạm đầu (quy định trình duyệt).
Nút 🔊 trên thiệp tắt/bật cả nhạc nền lẫn tiếng hiệu ứng. Muốn thêm tiếng ở chỗ mới: `import { sfx } from '../core/sfx.js'` rồi gọi `sfx.chime()`, `sfx.pop()`…

**Nhạc "hot trend":** không đưa sẵn bài hát có bản quyền vào web (dễ bị khiếu nại). Người tạo tự tải bài mình thích ở bước 3
("🎵 Nhạc của bạn"). Nhạc có sẵn thay ở `public/music/nhac-1.mp3` … `nhac-5.mp3` (nên lấy nhạc miễn phí bản quyền, ví dụ Pixabay).

### Kiểu chữ (`public/js/shared/fonts.js`)

Ở bước 2, người tạo chọn kiểu chữ cho lời nhắn, tên, chữ ký (cả chữ vẽ trong hiệu ứng vũ trụ, trái tim…):
Mềm mại (mặc định), Sang trọng, Dễ thương, Tròn trịa, Nhật ký, Bút mực, Dễ đọc. Mỗi ô hiện sẵn tên người nhận bằng kiểu đó,
ô có ✨ là kiểu gợi ý cho mẫu (`TEMPLATE_FONT`). Font chỉ tải khi thiệp dùng tới. Thêm kiểu mới: thêm một dòng ở `FONTS`
(font Google phải có bộ chữ "vietnamese"). Thiệp cũ không có kiểu chữ thì dùng "Mềm mại" như trước.

### Trang chủ gọn

Danh sách mẫu lọc theo nhóm (🔥 Hot, 🌷 20/10, 💕 Tình yêu, 🎂 Gia đình & bạn bè): sửa `CATEGORIES`, `BADGES` trong
`public/js/pages/home.js`. Chạm vào thẻ mẫu là xem thử (`/xem-truoc?demo=<id>`), trong đó có nút "💌 Dùng mẫu này".
Ở trình tạo, bước 2 chỉ hiện các ô chính (`MAIN_TEXTS` trong `public/js/pages/tao.js`), ô còn lại gấp vào "Sửa thêm câu chữ khác".

### Màn mở đầu (gắn được cho mọi mẫu)

| Hiệu ứng | Người nhận làm gì |
|---|---|
| 🎁 Hộp quà bí mật | Chạm lắc 3 lần, nắp bung, tia sáng + pháo giấy |
| 🔋 Sạc đầy yêu thương | Giữ tay lên trái tim tới 100% (có rung) |
| 🧩 Ghép ảnh mới mở | Xếp 9 mảnh ảnh đầu tiên (không có ảnh thì dùng hộp quà) |

Xem thử: `/xem-truoc?demo=to-tinh&mo=hop-qua`.

**Hiệu ứng nền** (`fx.bg`, file `public/js/fx/bg.js`): đom đóm, bong bóng, bướm, tuyết, trời sao, tim bay.

**Quay video:** nút "🎥 Lưu video 8 giây" trong thiệp hiệu ứng (trừ "Trái tim kỷ niệm"), chỉ có ở thiệp thật, không có ở bản xem thử. Video có tên web ở cuối, để người nhận đăng story/TikTok. Trình duyệt quá cũ không hỗ trợ thì nút tự ẩn.

### Trò chơi cuối thiệp (`public/js/shared/games.js`, `public/js/fx/games.js`)

| Trò | Cách chạy | Người tạo thấy gì |
|---|---|---|
| 🎡 Vòng quay quà tặng | Máy chủ bốc thăm, mỗi thiệp chỉ quay 1 lần (quay lại vẫn ra quà cũ) | "Quay trúng: 1 ly trà sữa" |
| 💯 Bạn hiểu tớ bao nhiêu? | Tối đa 5 câu trắc nghiệm, máy chủ chấm điểm, chỉ ghi lần đầu | Điểm + từng câu người nhận chọn |

API: `POST /api/choi/<slug>`. Kết quả lưu trong bảng `card_responses` (không cần migration mới).
Xem thử: `/xem-truoc?demo=xin-loi&choi=vong-quay&nen=dom-dom`, `/xem-truoc?demo=to-tinh&choi=cau-do&nen=buom`.

## 2. Đổi giá

Mở `public/js/shared/plans.js`, sửa `price` (đơn vị: đồng), `maxImages`, `days`. File này dùng chung cho cả trang web và server,
nên chỉ cần sửa một chỗ. Server luôn tự tính tiền từ file này, không tin số tiền trình duyệt gửi lên.

**Tính năng gói Đặc biệt** (`extras: true` và `PREMIUM_FEATURES` trong cùng file): lời nhắn giọng nói, mở cùng nhau,
quay phản ứng, nhạc tự tải lên chỉ có ở gói Đặc biệt và Combo. Server từ chối nếu thiệp dùng các tính năng này mà chọn
gói Cơ bản; trình tạo gắn nhãn "💎 Gói Đặc biệt" và khóa gói Cơ bản. Muốn mở cho mọi gói: đặt `extras: true` ở gói Cơ bản.
Bảng giá trang chủ viết ở `public/js/pages/home.js` (dòng ✓ / ✗ của từng gói).

**Gợi ý nâng gói ở trang thanh toán:** khách chọn Cơ bản thấy ô "Thêm 14.000đ → gói Đặc biệt"; chọn Đặc biệt thấy
"Thêm 20.000đ → được 3 thiệp" (Combo). Số tiền tự tính từ bảng giá.

**Nâng cấp sau khi gửi** (`UPGRADE` trong cùng file): thiệp Cơ bản đang hoạt động có nút "💎 Nâng cấp" ở trang quản lý,
trả phần chênh lệch (29k − 15k = 14k). Tiền về → thiệp thành gói Đặc biệt, link dùng thêm 365 ngày, link giữ nguyên.
Ở /admin đơn này hiện là "Nâng cấp lên Đặc biệt".

**Nhạc nền** đã nén còn 64kbps (khoảng 1MB/bài) cho mạng 4G yếu. Thay nhạc mới thì nén tương tự, ví dụ:
`ffmpeg -i bai-goc.mp3 -map_metadata -1 -c:a libmp3lame -b:a 64k public/music/nhac-1.mp3`.

**Combo 20/10** (`combo` trong cùng file): `price` là giá trả một lần, `cards` là số thiệp được tạo. Mỗi thiệp có quyền như
gói Đặc biệt. Thiệp đầu tiên chọn gói Combo và thanh toán. Trang thành công và trang quản lý hiện **mã combo** (10 ký tự).
Các thiệp sau bấm "Đã có mã combo?" ở bước chọn gói và dán mã, thiệp có link ngay. Hết mùa lễ muốn tắt combo thì xóa
mục `combo` khỏi `PLANS` (các mã đã bán vẫn dùng tiếp được). Trang quản trị ghi các thiệp dùng mã là "0đ (dùng mã combo)"
và không tính vào doanh thu.

**Cam kết hoàn tiền 24 giờ** (`GUARANTEE` trong cùng file): gói Cơ bản và Đặc biệt, không áp dụng cho Combo và thiệp tạo bằng mã combo.
Dòng cam kết hiện ở bảng giá, trang thanh toán và trang quản lý (trong 24 giờ). Trang quản lý có mã đơn để khách gửi kèm.
Cách xử lý (làm tay):
1. Khách nhắn Zalo kèm mã đơn.
2. Vào `/admin`, tìm mã đơn, bấm "Gỡ thiệp".
3. Chuyển khoản trả lại cho khách.

Muốn tắt cam kết: đặt `hours: 0`.

**Gói hiệu ứng gợi ý** (`PRESETS` trong `public/js/shared/effects.js`): các gói "Lãng mạn", "Đỉnh nóc"… ở bước 3. Thêm gói mới
bằng một dòng (mở đầu, nền, trò chơi).

**Thiệp của tôi** (`/thiep-cua-toi`): danh sách thiệp đã thanh toán, chỉ lưu trên trình duyệt của người tạo (localStorage).
Thiệp được ghi nhớ khi thanh toán xong hoặc khi mở link quản lý.

---

## 3. Cấu trúc code (kiến trúc phân lớp)

Code server chia thành 4 lớp, lớp trên chỉ gọi lớp dưới:

```
functions/
├── api/, t/                 ① LỚP ROUTE: nhận yêu cầu HTTP, gọi service, trả kết quả. Rất mỏng.
│   ├── api/_middleware.ts      bắt lỗi chung cho /api/*
│   ├── api/cards/index.ts      POST /api/cards       tạo thiệp nháp + đơn
│   ├── api/img/[slug]/[idx].ts GET  /api/img/...     trả ảnh
│   ├── api/reports.ts          POST /api/reports     báo cáo thiệp
│   ├── api/orders/[code]/      GET  trạng thái đơn · POST …/plan đổi gói
│   ├── api/sepay-webhook.ts    POST /api/sepay-webhook  SePay báo tiền về
│   ├── api/manage/[slug].ts    GET/PUT trang quản lý của người tạo
│   ├── api/combo.ts            POST kiểm tra mã combo còn mấy lượt
│   ├── api/tra-loi/[slug].ts   POST người nhận trả lời thiệp "Đi chơi"
│   ├── api/nhac/[slug].ts      GET  nhạc tự tải lên (hỗ trợ phát từng đoạn cho iPhone)
│   ├── api/admin/              trang quản trị: đăng nhập, tổng quan, tìm đơn, thao tác (cần cookie)
│   └── t/[slug].ts             GET  /t/<slug>        trang thiệp (nhúng sẵn dữ liệu)
└── _lib/
    ├── http/                ① tiện ích HTTP: đọc form, trả JSON, CSP
    ├── services/            ② LỚP DỊCH VỤ: điều phối một việc trọn vẹn (tạo thiệp, mở thiệp, báo cáo…)
    ├── domain/              ③ LỚP NGHIỆP VỤ: quy tắc thuần, không đụng cơ sở dữ liệu (gói, hạn dùng,
    │                           kiểm tra chữ/ảnh, lọc từ thô tục, sinh mã, tìm mã đơn) → dễ test
    ├── repositories/        ④ LỚP DỮ LIỆU: nơi duy nhất viết SQL cho D1.
    │                           interfaces.ts là "hợp đồng"; service chỉ biết hợp đồng này
    ├── container.ts         lắp ráp: tạo repository D1 rồi đưa vào service
    ├── config.ts            cấu hình server (thời hạn đơn, giới hạn, danh sách từ cấm)
    └── env.ts               khai báo biến môi trường

public/                      giao diện tĩnh (HTML/CSS/JS thuần, không cần build)
├── js/shared/               dùng chung với server: bảng giá, định nghĩa mẫu thiệp
├── js/core/                 module dùng lại: tạo phần tử an toàn, gọi API, lưu nháp, nén ảnh, nhạc, pháo hoa
├── js/card/player.js        hiển thị một tấm thiệp (dùng cho cả trang thật và xem trước)
├── js/templates/            giao diện từng mẫu thiệp
├── js/pages/                code riêng của từng trang
├── css/, data/, music/
migrations/                  file SQL tạo/sửa cơ sở dữ liệu
tests/                       test tự động (chạy bằng node --test, không cần cài thêm)
```

**Bảo mật:** chữ người dùng nhập luôn hiển thị bằng `textContent` (hàm `el()` trong `js/core/dom.js`), không dùng `innerHTML`.
Trang thiệp có CSP chặt, `noindex`. Mã sửa thiệp chỉ nằm sau dấu `#` của link quản lý; server chỉ lưu bản băm.

**Thay đổi nhỏ so với thiết kế gốc:**
- Bảng `cards` có thêm cột `image_count` để trang thiệp không phải đếm ảnh mỗi lần mở.
- Bảng mới `card_music` lưu nhạc tự tải lên, cắt thành nhiều phần vì một ô dữ liệu D1 chỉ chứa khoảng 2MB.
- Bảng `orders` có thêm `combo_code_hash`, `combo_used` (Combo 20/10). Bảng mới `card_responses` lưu câu trả lời mẫu "Đi chơi".
- Bảng `payments` và `reports` có thêm cột `resolved_at` để ẩn mục đã xử lý khỏi trang quản trị.
- Đăng nhập /admin không lưu phiên trên server: cookie được ký bằng mật khẩu quản trị (không cần KV, vẫn 0đ).

---

## 4. Thêm mẫu thiệp mới cho dịp lễ sau

1. Thêm một mục vào `TEMPLATES` trong `public/js/shared/templates.js`: id, tên, emoji, các mối quan hệ, các ô chữ (`texts`)
   kèm độ dài tối đa và chữ mặc định, `ready: true`. Ô cần chọn ngày thì thêm `type: 'date'` (xem mẫu `o-canh-em`: ngày yêu nhau, ngày gặp nhau). Muốn chữ mặc định khác nhau theo mối quan hệ thì thêm `relationshipDefaults`
   (xem mẫu `phu-nu-2010`). Trong mọi câu chữ có thể dùng `{ten}` để chèn tên người nhận.
   **Xưng hô cho cả nam lẫn nữ:** viết chữ mặc định và lời chúc bằng `{toi}`/`{Toi}` (người gửi tự xưng) và `{ban}`/`{Ban}`
   (gọi người nhận), ví dụ `'Làm người yêu {toi} nhé?'`. Người tạo chọn "Tớ – cậu", "Anh – em", "Em – anh"… ở bước 1, chữ tự đổi
   theo. Các cách xưng hô cho từng mối quan hệ nằm trong `public/js/shared/pronouns.js`. Mẫu muốn giới hạn lại thì thêm
   `pronouns` (xem `phu-nu-2010`: ngày 20/10 người nhận là nữ nên không có "Em – anh").
2. Tạo `public/js/templates/<id>.js` có hàm `render(stage, ctx)`. Xem `xin-loi.js` làm mẫu (ngắn nhất).
   - `ctx.data`: nội dung thiệp, `ctx.imageUrls`: ảnh, `ctx.onStart()`: gọi trong cú chạm đầu tiên để bật nhạc,
     `ctx.onFinish()`: hiện nút "Tạo thiệp của bạn" ở cuối.
   - Mẫu cần người nhận trả lời (như `di-choi.js`): gọi `ctx.onAnswer(câu trả lời)`, rồi thêm id mẫu vào
     `ANSWERABLE_TEMPLATES` trong `functions/_lib/services/response-service.ts`. Câu trả lời hiện ở trang quản lý.
   - Dùng lại mảnh ghép trong `templates/common.js` (màn mở đầu, lá thư) và hiệu ứng trong `js/core/`:
     `fireworks.js` (pháo hoa), `hearts.js` (tim bay), `petals.js` (hoa rơi), `typewriter.js` (chữ hiện dần), `slideshow.js` (ảnh).
3. Tạo `public/css/templates/<id>.css`: đặt bảng màu bằng các biến `--card-bg`, `--tt-accent`, `--tt-wine` trong `.theme-<id>`.
4. Đăng ký trong `public/js/templates/registry.js` và thêm "điện thoại mini" ở `MINI_DEMOS` trong `public/js/pages/home.js`.
5. Thêm lời chúc gợi ý vào `public/data/loi-chuc.json` theo dạng `"<id>": { "<mối quan hệ>": [ ... ] }` (6–10 lời mỗi nhóm, 2–5 câu mỗi lời).
6. Chạy `npm test`: test tự kiểm tra lời chúc có đủ cho mọi mối quan hệ, không thô tục, không quá dài.

Server tự kiểm tra dữ liệu theo khai báo ở bước 1, không cần sửa gì thêm.

## 5. Đưa lên mạng (deploy)

Web đang chạy thật tại **https://guiyeuthuong.pages.dev** (Cloudflare Pages + Functions + D1, gói miễn phí).

### Cập nhật bản mới (việc làm thường xuyên)

```bash
npm run deploy
```

Lệnh này lần lượt: chạy test (lỗi là dừng, không đưa gì lên) → cập nhật cơ sở dữ liệu trên mạng nếu có file mới
trong `migrations/` (hỏi "Ok to proceed?" thì gõ `y`) → đưa code lên. Xong sau khoảng 1 phút.

### Khóa bí mật trên Cloudflare

| Tên | Là gì |
|---|---|
| `SEPAY_WEBHOOK_KEY` | Khóa webhook, phải giống ô "API Key" trên SePay |
| `SEPAY_ACC`, `SEPAY_BANK` | Số tài khoản và tên ngân hàng nhận tiền (ví dụ `MBBank`) |
| `SEPAY_API_TOKEN` | API Access của SePay (tự đối soát khi webhook trễ) |
| `SUPPORT_ZALO` | Số Zalo hiện ở trang /ho-tro |
| `ADMIN_PASSWORD` | Mật khẩu trang /admin, **tối thiểu 10 ký tự** (ngắn hơn thì trang quản trị tự tắt) |

Đặt hoặc đổi một khóa (gõ giá trị khi được hỏi, giá trị không hiện ra màn hình):

```bash
npm run dat-mat-khau-admin                                                # riêng mật khẩu /admin
npx wrangler pages secret put SUPPORT_ZALO --project-name guiyeuthuong    # các khóa khác: đổi tên khóa
```

Rồi `npm run deploy` để áp dụng. Xem danh sách tên khóa: `npx wrangler pages secret list --project-name guiyeuthuong`.
**Không bao giờ** đặt `DEV_SIMULATE_PAYMENT` trên Cloudflare (dù có đặt, nút giả lập vẫn bị khóa vì chỉ chạy ở máy).

### Cấu hình SePay (my.sepay.vn)

1. **WebHooks → Thêm webhook**: sự kiện *Có tiền vào*; URL `https://guiyeuthuong.pages.dev/api/sepay-webhook`;
   kiểu chứng thực **API Key**, API Key = giá trị `SEPAY_WEBHOOK_KEY`; "Bỏ qua nếu nội dung không có Code thanh toán" = **Không**.
2. **Cấu hình công ty → Cấu trúc mã thanh toán**: tiền tố `TX`, phần sau 4 ký tự (chữ + số).
3. Bấm "Gửi thử" trên SePay: kết quả phải là HTTP 200. Nếu 401 là sai khóa hoặc chưa chọn kiểu API Key.

### Thử lại trên điện thoại thật sau mỗi lần deploy

- Mở `https://guiyeuthuong.pages.dev` **trong Zalo và Messenger** (gửi link cho chính mình rồi bấm), cả iPhone lẫn Android.
- Xem thử từng mẫu → chạm mở thiệp → nhạc phát, hiệu ứng mượt.
- Tạo một thiệp gói Cơ bản, chuyển khoản thật 15.000đ: trang thanh toán phải tự chuyển sang "Thiệp đã sẵn sàng" trong vài giây.
- Mở link thiệp trên máy khác. Bấm "Báo cáo thiệp" rồi vào /admin xem báo cáo hiện ra.

### Làm lại từ đầu trên tài khoản Cloudflare khác (tham khảo)

```bash
npx wrangler login
npx wrangler d1 create guiyeuthuong-db            # chép database_id vào wrangler.toml
npm run db:migrate:remote
npx wrangler pages project create guiyeuthuong --production-branch main
npx wrangler pages secret put SEPAY_WEBHOOK_KEY --project-name guiyeuthuong   # lặp lại cho từng khóa ở bảng trên
npm run deploy
```

---

## 6. Trang quản trị /admin

Mở `https://guiyeuthuong.pages.dev/admin`, đăng nhập bằng `ADMIN_PASSWORD` (ở máy: giá trị trong `.dev.vars`).
Phiên đăng nhập giữ 12 giờ; sai 5 lần thì khóa 15 phút. Đổi mật khẩu là mọi phiên cũ bị đăng xuất.

- **Doanh thu** hôm nay / 7 ngày / 30 ngày (theo giờ Việt Nam).
- **Giao dịch cần xem**: khách chuyển thiếu tiền, sai nội dung, hoặc tiền không liên quan đến app (tiền người quen chuyển
  vào tài khoản cũng hiện ở đây). Tiền của khách → nhập mã đơn → **Kích hoạt thủ công**. Không liên quan → **Bỏ qua**.
- **Báo cáo thiệp**: xem thiệp, rồi **Gỡ thiệp** (link chết, ảnh và nhạc bị xóa vĩnh viễn) hoặc **Không vi phạm**.
- **Tìm đơn**: khách nhắn Zalo kèm mã đơn (TXAB23) hoặc link thiệp → tìm ra đơn, kích hoạt hoặc gỡ ngay tại đó.

**Dọn dẹp tự động (không dùng cron):** mỗi lần có đơn mới, app xóa tối đa 5 thiệp nháp chưa trả tiền quá 24 giờ
(trừ thiệp đang có giao dịch cần xem) và chuyển tối đa 20 thiệp hết hạn sang "hết hạn", xóa ảnh và nhạc của chúng.
Đổi các con số này ở `functions/_lib/config.ts` (mục `CLEANUP`).
