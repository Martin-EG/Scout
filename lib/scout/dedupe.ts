import type { Hit } from "@/types/domain";

/** Query params that only track where a click came from. Exact names, plus any utm_* key. */
const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "msclkid",
  "yclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "ref",
  "ref_src",
  "ref_url",
  "share_id",
  "si",
  // Reddit's machine-translation view (?tl=es-419): same thread.
  "tl",
  "_ga",
]);

const REDDIT_HOSTS = /^(?:www\.|old\.|new\.|np\.|m\.|i\.)?reddit\.com$/;

/**
 * Canonical form used for lead identity: https, lowercase host, reddit hosts
 * folded to www.reddit.com, tracking params and fragment removed, remaining
 * params sorted, trailing slashes stripped. Unparseable input is returned trimmed.
 */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!URL.canParse(trimmed)) return trimmed;
  const url = new URL(trimmed);
  let host = url.host.toLowerCase();
  if (REDDIT_HOSTS.test(host)) host = "www.reddit.com";

  const params = [...url.searchParams.entries()]
    .filter(([key]) => !key.toLowerCase().startsWith("utm_") && !TRACKING_PARAMS.has(key.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b));
  const search = params.length > 0 ? `?${new URLSearchParams(params)}` : "";
  const path = url.pathname.replace(/\/+$/, "");
  const protocol = url.protocol === "http:" ? "https:" : url.protocol;

  return `${protocol}//${host}${path}${search}`;
}

/**
 * Normalizes hit URLs, merges duplicates within the run (keeping the copy with
 * a date or author), and drops hits already stored as leads for the project.
 * `existingUrls` must already be normalized.
 */
export function dedupeHits(hits: Hit[], existingUrls: ReadonlySet<string>): Hit[] {
  const byUrl = new Map<string, Hit>();
  for (const hit of hits) {
    const url = normalizeUrl(hit.url);
    if (existingUrls.has(url)) continue;
    const candidate = { ...hit, url };
    const current = byUrl.get(url);
    if (!current || richness(candidate) > richness(current)) byUrl.set(url, candidate);
  }
  return [...byUrl.values()];
}

function richness(hit: Hit): number {
  return (hit.postedAt ? 2 : 0) + (hit.author ? 1 : 0) + (hit.snippet ? 1 : 0);
}
