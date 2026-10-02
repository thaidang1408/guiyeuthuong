// So sánh chuỗi bí mật "an toàn thời gian": thời gian so sánh không phụ thuộc vào việc
// chuỗi đúng tới ký tự thứ mấy, nên kẻ xấu không đoán dần được khóa qua thời gian phản hồi.

async function digest(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

export async function safeEqual(a: string, b: string): Promise<boolean> {
  // Băm cả hai trước để luôn so sánh hai dãy 32 byte, bất kể độ dài ban đầu.
  const [x, y] = await Promise.all([digest(a), digest(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
