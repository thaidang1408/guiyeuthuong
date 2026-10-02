import { notFound } from '../domain/errors.ts';
import { SLUG_PATTERN, sha256Hex } from '../domain/ids.ts';
import { safeEqual } from '../domain/security.ts';
import type { CardRecord, CardRepository } from '../repositories/interfaces.ts';

/**
 * Tìm thiệp và kiểm tra mã sửa (editToken) của người tạo.
 * Sai slug hay sai mã đều trả cùng một lỗi để không lộ thiệp nào có tồn tại.
 */
export async function findCardWithToken(cards: CardRepository, slug: unknown, token: unknown): Promise<CardRecord> {
  if (typeof slug !== 'string' || !SLUG_PATTERN.test(slug) || typeof token !== 'string' || token.length < 16 || token.length > 100) {
    throw notFound('Link quản lý không đúng hoặc đã bị thay đổi.');
  }
  const card = await cards.findBySlug(slug);
  if (!card || card.status === 'removed' || !(await safeEqual(await sha256Hex(token), card.editTokenHash))) {
    throw notFound('Link quản lý không đúng hoặc đã bị thay đổi.');
  }
  return card;
}
