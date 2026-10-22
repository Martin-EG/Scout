import { z } from "zod";
import { SOURCES } from "@/lib/config";
import type { Hit } from "@/types/domain";
import { unixSecondsToISO } from "./dates";
import { getJSON, getText, type GetOptions } from "./http";
import { createRateLimiter } from "./rateLimit";
import { decodeEntities, stripHtml } from "./text";
import { SourceBlockedError, SourceError, type AdapterDeps, type SourceAdapter } from "./types";
import { subredditVenue, venueFromUrl } from "./venue";

const cfg = SOURCES.reddit;
const DELETED_AUTHORS = new Set(["[deleted]", "[removed]"]);

const listingSchema = z.object({
  data: z.object({
    children: z.array(
      z.object({
        data: z.object({
          subreddit: z.string(),
          title: z.string(),
          selftext: z.string().optional().default(""),
          author: z.string().optional(),
          created_utc: z.number(),
          permalink: z.string(),
        }),
      }),
    ),
  }),
});

/** Maps a search.json Listing to hits. Exported for fixture tests. */
export function mapRedditResponse(body: unknown): Hit[] {
  const parsed = listingSchema.safeParse(body);
  if (!parsed.success) throw new SourceError("reddit: unexpected response shape", "reddit");
  return parsed.data.data.children.map(({ data: post }) => ({
    source: "reddit",
    url: `${cfg.baseUrl}${post.permalink}`,
    title: post.title,
    snippet: post.selftext,
    ...(post.author && !DELETED_AUTHORS.has(post.author) ? { author: post.author } : {}),
    postedAt: unixSecondsToISO(post.created_utc),
    ...subredditVenue(post.subreddit),
  }));
}

const tag = (entry: string, name: string): string | undefined =>
  new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(entry)?.[1];

/**
 * Maps a search.rss Atom feed to hits. Keeps posts (t3_) only; the feed also
 * lists matching subreddits (t5_). Exported for fixture tests.
 */
export function mapRedditRss(xml: string): Hit[] {
  if (!xml.includes("<feed")) throw new SourceError("reddit: unexpected RSS body", "reddit");
  const hits: Hit[] = [];
  for (const entry of xml.split("<entry>").slice(1)) {
    if (!tag(entry, "id")?.startsWith("t3_")) continue;
    const link = /<link href="([^"]+)"/.exec(entry)?.[1];
    const title = tag(entry, "title");
    if (!link || !title || !URL.canParse(decodeEntities(link))) continue;
    const url = decodeEntities(link);
    const author = tag(entry, "name")?.replace(/^\/u\//, "");
    const published = tag(entry, "published");
    hits.push({
      source: "reddit",
      url,
      title: decodeEntities(title),
      snippet: stripHtml(decodeEntities(tag(entry, "content") ?? "")),
      ...(author && !DELETED_AUTHORS.has(author) ? { author } : {}),
      ...(published && !Number.isNaN(Date.parse(published))
        ? { postedAt: new Date(published).toISOString() }
        : {}),
      ...venueFromUrl(url),
    });
  }
  return hits;
}

/**
 * Reddit public search, newest posts from the last month. Uses search.json;
 * after a 403/429 there it switches to search.rss (1 request/minute, capped
 * per run). Throws SourceBlockedError when both are unavailable.
 */
export class RedditSource implements SourceAdapter {
  readonly source = "reddit";
  private readonly fetchImpl: typeof fetch;
  private readonly throttle;
  private readonly rssThrottle;
  private jsonBlocked = false;
  private rssQueries = 0;

  constructor(deps: AdapterDeps = {}) {
    this.fetchImpl = deps.fetch ?? fetch;
    this.throttle = createRateLimiter(cfg.minIntervalMs, deps.now, deps.sleep);
    this.rssThrottle = createRateLimiter(cfg.rssMinIntervalMs, deps.now, deps.sleep);
  }

  async search(query: string): Promise<Hit[]> {
    const params = new URLSearchParams({
      q: query,
      sort: "new",
      t: cfg.timeWindow,
      type: "link",
      limit: String(cfg.resultsPerQuery),
      raw_json: "1",
    });
    const get: GetOptions = { source: this.source, timeoutMs: cfg.timeoutMs, fetch: this.fetchImpl };

    if (!this.jsonBlocked) {
      await this.throttle();
      try {
        return mapRedditResponse(await getJSON(`${cfg.baseUrl}/search.json?${params}`, get));
      } catch (err) {
        if (!(err instanceof SourceBlockedError)) throw err;
        this.jsonBlocked = true;
      }
    }

    if (this.rssQueries >= cfg.rssMaxQueriesPerRun) {
      throw new SourceBlockedError("reddit: RSS query budget for this run used", this.source);
    }
    this.rssQueries++;
    await this.rssThrottle();
    return mapRedditRss(await getText(`${cfg.baseUrl}/search.rss?${params}`, "application/atom+xml", get));
  }
}
