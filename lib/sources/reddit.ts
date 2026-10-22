import { z } from "zod";
import { SOURCES } from "@/lib/config";
import type { Hit } from "@/types/domain";
import { unixSecondsToISO } from "./dates";
import { getJSON } from "./http";
import { createRateLimiter } from "./rateLimit";
import { SourceError, type AdapterDeps, type SourceAdapter } from "./types";
import { subredditVenue } from "./venue";

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

/** Reddit's public search JSON: newest posts from the last month. */
export class RedditSource implements SourceAdapter {
  readonly source = "reddit";
  private readonly fetchImpl: typeof fetch;
  private readonly throttle = createRateLimiter(cfg.minIntervalMs);

  constructor(deps: AdapterDeps = {}) {
    this.fetchImpl = deps.fetch ?? fetch;
  }

  async search(query: string): Promise<Hit[]> {
    const params = new URLSearchParams({
      q: query,
      sort: "new",
      t: cfg.timeWindow,
      limit: String(cfg.resultsPerQuery),
      raw_json: "1",
    });
    await this.throttle();
    const body = await getJSON(`${cfg.baseUrl}/search.json?${params}`, {
      source: this.source,
      timeoutMs: cfg.timeoutMs,
      fetch: this.fetchImpl,
    });
    return mapRedditResponse(body);
  }
}
