import { SCOUT } from "@/lib/config";
import type { Hit } from "@/types/domain";

const DAY_MS = 86_400_000;

export interface ScoreThresholds {
  maxAgeDays: number;
  minRelevance: number;
  minIntent: number;
}

export const DEFAULT_THRESHOLDS: ScoreThresholds = {
  maxAgeDays: SCOUT.maxHitAgeDays,
  minRelevance: SCOUT.minRelevance,
  minIntent: SCOUT.minIntent,
};

export interface ScoredHit extends Hit {
  authorType: "person" | "publisher";
  relevance: number;
  intent: number;
  reason: string;
}

/** True when the hit has a date older than the limit. Undated hits are not "too old". */
export function isTooOld(hit: Pick<Hit, "postedAt">, now: number, maxAgeDays: number): boolean {
  if (!hit.postedAt) return false;
  const posted = Date.parse(hit.postedAt);
  return !Number.isNaN(posted) && now - posted > maxAgeDays * DAY_MS;
}

/**
 * Keep a scored hit only if a person wrote it (not a brand, blog, or store), it is
 * recent enough, relevant enough, and shows enough intent.
 */
export function passesScoreRules(hit: ScoredHit, now: number, t: ScoreThresholds = DEFAULT_THRESHOLDS): boolean {
  return (
    hit.authorType === "person" &&
    !isTooOld(hit, now, t.maxAgeDays) &&
    hit.relevance >= t.minRelevance &&
    hit.intent >= t.minIntent
  );
}

/** Kept leads, best first: intent, then relevance. */
export function applyScoreRules(
  hits: ScoredHit[],
  now: number,
  t: ScoreThresholds = DEFAULT_THRESHOLDS,
): ScoredHit[] {
  return hits
    .filter((hit) => passesScoreRules(hit, now, t))
    .sort((a, b) => b.intent - a.intent || b.relevance - a.relevance);
}

function hostOf(url: string): string | null {
  return URL.canParse(url) ? new URL(url).hostname.toLowerCase().replace(/^www\./, "") : null;
}

/** True for store listings and the project's own site: places to read about apps, not to reply. */
export function isSkippedDomain(
  hit: Pick<Hit, "url">,
  projectUrl: string,
  skipDomains: readonly string[] = SCOUT.skipDomains,
): boolean {
  const host = hostOf(hit.url);
  if (!host) return true;
  const own = hostOf(projectUrl);
  return host === own || skipDomains.some((d) => host === d || host.endsWith(`.${d}`));
}

/**
 * Before scoring: drop hits already too old, then cap the batch, newest first
 * (undated hits after dated ones), so the scorer's time goes to fresh threads.
 */
export function selectHitsToScore(
  hits: Hit[],
  now: number,
  max: number = SCOUT.maxHitsToScore,
  maxAgeDays: number = SCOUT.maxHitAgeDays,
): Hit[] {
  const time = (hit: Hit) => (hit.postedAt ? Date.parse(hit.postedAt) : -Infinity);
  return hits
    .filter((hit) => !isTooOld(hit, now, maxAgeDays))
    .sort((a, b) => time(b) - time(a))
    .slice(0, max);
}
