const OFFSET = 7 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** 0 giờ ngày 1 của tháng này theo giờ Việt Nam. */
export function startOfMonthVietnam(now: number): number {
  const d = new Date(now + OFFSET);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - OFFSET;
}

/** 0 giờ hôm nay theo giờ Việt Nam (UTC+7), dạng mili-giây. */
export function startOfDayVietnam(now: number): number {
  return Math.floor((now + OFFSET) / DAY_MS) * DAY_MS - OFFSET;
}
