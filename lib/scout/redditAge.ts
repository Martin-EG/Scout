// Dates for undated Reddit hits. Web search often returns old Reddit threads
// with no date, which would slip past the age rule. Post ids are base-36 and
// grow with time, so a line through dated posts gives a good estimate.
import { SCOUT } from "@/lib/config";
import type { Hit } from "@/types/domain";

const POST_ID = /reddit\.com\/r\/[^/]+\/comments\/([a-z0-9]+)/i;

export interface IdTimeLine {
  /** Milliseconds per id step. */
  slope: number;
  intercept: number;
}

/** Numeric post id from a Reddit thread URL, or null. */
export function redditPostId(url: string): number | null {
  const id = POST_ID.exec(url)?.[1];
  return id ? parseInt(id, 36) : null;
}

/** Least-squares line time = slope * id + intercept. Null if fewer than two distinct ids. */
export function fitIdTimeLine(points: { id: number; time: number }[]): IdTimeLine | null {
  const ids = new Set(points.map((p) => p.id));
  if (ids.size < 2) return null;
  const n = points.length;
  const meanId = points.reduce((sum, p) => sum + p.id, 0) / n;
  const meanTime = points.reduce((sum, p) => sum + p.time, 0) / n;
  let covariance = 0;
  let variance = 0;
  for (const p of points) {
    covariance += (p.id - meanId) * (p.time - meanTime);
    variance += (p.id - meanId) ** 2;
  }
  const slope = covariance / variance;
  if (!(slope > 0)) return null;
  return { slope, intercept: meanTime - slope * meanId };
}

const anchorPoints = () =>
  SCOUT.redditIdAnchors.map((a) => ({ id: parseInt(a.id, 36), time: Date.parse(a.postedAt) }));

/**
 * Calibrates on Reddit-source hits that carry a real date (the most accurate),
 * falling back to the config anchors.
 */
export function calibrate(hits: Hit[]): IdTimeLine | null {
  const points = hits.flatMap((hit) => {
    if (hit.source !== "reddit" || !hit.postedAt || hit.postedAtEstimated) return [];
    const id = redditPostId(hit.url);
    const time = Date.parse(hit.postedAt);
    return id !== null && !Number.isNaN(time) ? [{ id, time }] : [];
  });
  return fitIdTimeLine(points) ?? fitIdTimeLine(anchorPoints());
}

/** Gives undated Reddit thread hits an estimated postedAt (flagged). Other hits are unchanged. */
export function estimateRedditDates(hits: Hit[], line: IdTimeLine | null = calibrate(hits)): Hit[] {
  if (!line) return hits;
  return hits.map((hit) => {
    if (hit.postedAt) return hit;
    const id = redditPostId(hit.url);
    if (id === null) return hit;
    const estimate = line.slope * id + line.intercept;
    return { ...hit, postedAt: new Date(estimate).toISOString(), postedAtEstimated: true };
  });
}
