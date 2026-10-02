import { PLANS } from '../config.ts';
import { badRequest } from './errors.ts';
import { UPGRADE } from '../../../public/js/shared/plans.js';

export type PlanId = keyof typeof PLANS;
export type Plan = (typeof PLANS)[PlanId];

const DAY_MS = 24 * 60 * 60 * 1000;

export function getPlan(planId: unknown): Plan {
  if (typeof planId !== 'string' || !Object.hasOwn(PLANS, planId)) {
    throw badRequest('Gói không hợp lệ.');
  }
  return PLANS[planId as PlanId];
}

/** Gói dùng để tính hạn khi đơn được trả (đơn nâng cấp → gói Đặc biệt). */
export function planForOrder(planId: string): Plan {
  return planId === UPGRADE.id ? PLANS[UPGRADE.to as PlanId] : getPlan(planId);
}

/** Ngày hết hạn link = thời điểm thanh toán + số ngày của gói. */
export function computeExpiry(plan: Plan, paidAt: number): number {
  return paidAt + plan.days * DAY_MS;
}

export function isExpired(expiresAt: number | null, now: number): boolean {
  return expiresAt !== null && expiresAt <= now;
}
