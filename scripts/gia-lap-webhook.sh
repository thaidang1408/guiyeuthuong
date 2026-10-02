#!/usr/bin/env bash
# Giả lập SePay báo có tiền chuyển vào, để thử thanh toán ở máy mà không cần chuyển tiền thật.
#
# Cách dùng (server đang chạy bằng `npm run dev`):
#   bash scripts/gia-lap-webhook.sh TXABCD 15000          # chuyển đủ 15.000đ cho đơn TXABCD
#   bash scripts/gia-lap-webhook.sh TXABCD 10000          # chuyển thiếu → đơn cần duyệt tay
#   bash scripts/gia-lap-webhook.sh TXABCD 15000 sai-khoa # thử khóa sai → phải bị từ chối (401)
#
# Gửi lại đúng lệnh với cùng SEPAY_ID=... để thử giao dịch trùng:
#   SEPAY_ID=123 bash scripts/gia-lap-webhook.sh TXABCD 15000
set -euo pipefail

CODE="${1:?Thiếu mã đơn. Ví dụ: bash scripts/gia-lap-webhook.sh TXABCD 15000}"
AMOUNT="${2:?Thiếu số tiền. Ví dụ: bash scripts/gia-lap-webhook.sh TXABCD 15000}"
URL="${URL:-http://127.0.0.1:8788}"
ID="${SEPAY_ID:-$(date +%s%N | cut -c1-13)}"

# Đọc khóa từ .dev.vars (hoặc lấy tham số thứ 3 nếu muốn thử khóa sai).
KEY="${3:-$(grep -E '^SEPAY_WEBHOOK_KEY=' .dev.vars | cut -d= -f2- | tr -d '\r')}"

curl -sS -X POST "$URL/api/sepay-webhook" \
  -H "Content-Type: application/json" \
  -H "Authorization: Apikey $KEY" \
  -w "\nHTTP %{http_code}\n" \
  -d "{
    \"id\": $ID,
    \"gateway\": \"MBBank\",
    \"transactionDate\": \"$(date '+%Y-%m-%d %H:%M:%S')\",
    \"accountNumber\": \"0000000000\",
    \"code\": null,
    \"content\": \"NGUYEN VAN A chuyen tien $CODE\",
    \"transferType\": \"in\",
    \"transferAmount\": $AMOUNT,
    \"accumulated\": 0,
    \"subAccount\": null,
    \"referenceCode\": \"FT$ID\",
    \"description\": \"\"
  }"
