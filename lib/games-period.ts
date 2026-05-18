/**
 * Lightweight port of delivery-backend/src/games/games-period.util.ts so the
 * admin panel can compute the next draw / next winner time without round-tripping
 * to the API. Times are in Tunisia time zone (UTC+1, no DST).
 */

const TUNISIA_OFFSET_HOURS = 1;

type GameLike = {
  periodMode: string;
  customPeriodDays?: number | null;
  customPeriodAnchor?: string | null;
  createdAt: Date | string;
};

function tunisiaParts(d: Date): { year: number; month: number; day: number; weekday: number } {
  const t = new Date(d.getTime() + TUNISIA_OFFSET_HOURS * 3600 * 1000);
  return {
    year: t.getUTCFullYear(),
    month: t.getUTCMonth() + 1,
    day: t.getUTCDate(),
    weekday: t.getUTCDay(),
  };
}

function tunisiaDateKey(d: Date = new Date()): string {
  const p = tunisiaParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function tunisiaDayStartUtc(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  // Tunisia 00:00 == UTC (00:00 - 1h) the previous day
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1) - TUNISIA_OFFSET_HOURS * 3600 * 1000);
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const d = tunisiaDayStartUtc(dateKey);
  d.setUTCDate(d.getUTCDate() + days);
  return tunisiaDateKey(d);
}

function weekStartKey(dateKey: string): string {
  const d = tunisiaDayStartUtc(dateKey);
  const p = tunisiaParts(d);
  const diff = p.weekday === 0 ? 6 : p.weekday - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return tunisiaDateKey(d);
}

export function getCurrentPeriodEnd(game: GameLike, at: Date = new Date()): Date {
  const dateKey = tunisiaDateKey(at);
  const p = tunisiaParts(at);

  if (game.periodMode === "DAILY") {
    return new Date(tunisiaDayStartUtc(dateKey).getTime() + 24 * 3600 * 1000);
  }

  if (game.periodMode === "WEEKLY") {
    const ws = weekStartKey(dateKey);
    return tunisiaDayStartUtc(addDaysToDateKey(ws, 7));
  }

  if (game.periodMode === "MONTHLY") {
    const nextMonth = p.month === 12 ? 1 : p.month + 1;
    const nextYear = p.month === 12 ? p.year + 1 : p.year;
    return tunisiaDayStartUtc(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01`);
  }

  // CUSTOM
  const days = game.customPeriodDays ?? 5;
  const anchor = game.customPeriodAnchor ?? "FIXED_BLOCKS";
  const gameStartKey = tunisiaDateKey(new Date(game.createdAt));

  if (anchor === "ROLLING") {
    let cursor = gameStartKey;
    let blockStart = gameStartKey;
    while (true) {
      const next = addDaysToDateKey(cursor, days);
      if (dateKey < next) break;
      blockStart = cursor;
      cursor = next;
    }
    return tunisiaDayStartUtc(addDaysToDateKey(blockStart, days));
  }

  const startUtc = tunisiaDayStartUtc(gameStartKey).getTime();
  const nowUtc = tunisiaDayStartUtc(dateKey).getTime();
  const dayMs = 24 * 3600 * 1000;
  const elapsed = Math.floor((nowUtc - startUtc) / dayMs);
  const blockIndex = Math.floor(elapsed / days);
  const blockStartKey = addDaysToDateKey(gameStartKey, blockIndex * days);
  return tunisiaDayStartUtc(addDaysToDateKey(blockStartKey, days));
}
