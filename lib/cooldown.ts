import { VENUE_COOLDOWN_DAYS } from "@/lib/config";

const DAY_MS = 86_400_000;

/** True when the venue was posted in within the cooldown window (default 7 days). */
export function isInCooldown(
  lastPostedAt: string | null | undefined,
  now: number,
  days: number = VENUE_COOLDOWN_DAYS,
): boolean {
  if (!lastPostedAt) return false;
  const posted = Date.parse(lastPostedAt);
  return !Number.isNaN(posted) && now - posted < days * DAY_MS;
}
