import { z } from "zod";
import { SOURCES } from "@/lib/config";
import type { Hit } from "@/types/domain";
import { unixSecondsToISO } from "./dates";
import { getJSON } from "./http";
import { createRateLimiter } from "./rateLimit";
import { stripHtml } from "./text";
import { SourceError, type AdapterDeps, type SourceAdapter } from "./types";

const cfg = SOURCES.hackernews;
const DAY_SECONDS = 86_400;
const HN_ITEM_URL = "https://news.ycombinator.com/item?id=";
const HN_VENUE = { venueName: "Hacker News", venueUrl: "https://news.ycombinator.com/" };

const nullableString = z.string().nullish();

const responseSchema = z.object({
  hits: z.array(
    z.object({
      objectID: z.string(),
      author: nullableString,
      created_at_i: z.number(),
      title: nullableString,
      story_title: nullableString,
      story_text: nullableString,
      comment_text: nullableString,
    }),
  ),
});

/** Maps an Algolia HN response (stories and comments) to hits. Exported for fixture tests. */
export function mapHackerNewsResponse(body: unknown): Hit[] {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) throw new SourceError("hackernews: unexpected response shape", "hackernews");
  return parsed.data.hits.map((item) => {
    const isComment = Boolean(item.comment_text);
    const title = isComment
      ? `Comment on: ${item.story_title ?? "HN thread"}`
      : (item.title ?? item.story_title ?? "HN item");
    return {
      source: "hackernews",
      url: `${HN_ITEM_URL}${item.objectID}`,
      title,
      snippet: stripHtml(item.comment_text ?? item.story_text ?? ""),
      ...(item.author ? { author: item.author } : {}),
      postedAt: unixSecondsToISO(item.created_at_i),
      ...HN_VENUE,
    };
  });
}

/** Algolia Hacker News search: stories and comments from the last 30 days. */
export class HackerNewsSource implements SourceAdapter {
  readonly source = "hackernews";
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly throttle = createRateLimiter(cfg.minIntervalMs);

  constructor(deps: AdapterDeps = {}) {
    this.fetchImpl = deps.fetch ?? fetch;
    this.now = deps.now ?? Date.now;
  }

  async search(query: string): Promise<Hit[]> {
    const since = Math.floor(this.now() / 1000) - cfg.maxAgeDays * DAY_SECONDS;
    const params = new URLSearchParams({
      query,
      tags: "(story,comment)",
      numericFilters: `created_at_i>${since}`,
      hitsPerPage: String(cfg.resultsPerQuery),
    });
    await this.throttle();
    const body = await getJSON(`${cfg.baseUrl}/search?${params}`, {
      source: this.source,
      timeoutMs: cfg.timeoutMs,
      fetch: this.fetchImpl,
    });
    return mapHackerNewsResponse(body);
  }
}
