const MS = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
  month: 2_592_000_000, // 30 days
  year: 31_536_000_000, // 365 days
} as const;

const RELATIVE = /^(\d+)\s+(minute|min|hour|day|week|month|year)s?\s+ago$/i;
/** ISO date-time without an offset (SearXNG emits these); read as UTC, not local time. */
const NAIVE_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;
const UNIT_ALIASES: Record<string, keyof typeof MS> = { min: "minute" };

export function unixSecondsToISO(seconds: number): string {
  return new Date(seconds * 1000).toISOString();
}

/** Lenient date parse for search snippets: "3 days ago", "Oct 7, 2026", ISO strings. */
export function parseLooseDate(text: string | null | undefined, now: number): string | undefined {
  if (!text) return undefined;
  const trimmed = text.trim();
  const relative = RELATIVE.exec(trimmed);
  if (relative) {
    const unit = relative[2].toLowerCase();
    const ms = MS[UNIT_ALIASES[unit] ?? (unit as keyof typeof MS)];
    return new Date(now - Number(relative[1]) * ms).toISOString();
  }
  const parsed = Date.parse(NAIVE_ISO.test(trimmed) ? `${trimmed}Z` : trimmed);
  return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
}
