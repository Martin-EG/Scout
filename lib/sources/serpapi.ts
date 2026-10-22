import { z } from "zod";
import { SOURCES } from "@/lib/config";
import type { Hit } from "@/types/domain";
import { parseLooseDate } from "./dates";
import { getJSON } from "./http";
import { createRateLimiter } from "./rateLimit";
import { SourceError, type AdapterDeps, type SearchOptions, type SourceAdapter } from "./types";
import { venueFromUrl } from "./venue";

const cfg = SOURCES.serpapi;

const responseSchema = z.object({
  error: z.string().optional(),
  organic_results: z
    .array(
      z.object({
        link: z.string(),
        title: z.string(),
        snippet: z.string().nullish(),
        date: z.string().nullish(),
      }),
    )
    .optional()
    .default([]),
});

/** Maps a SerpApi Google response to hits. Exported for fixture tests. */
export function mapSerpApiResponse(body: unknown, now: number): Hit[] {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) throw new SourceError("serpapi: unexpected response shape", "serpapi");
  const hits: Hit[] = [];
  for (const result of parsed.data.organic_results) {
    if (!URL.canParse(result.link)) continue;
    const postedAt = parseLooseDate(result.date, now);
    hits.push({
      source: "serpapi",
      url: result.link,
      title: result.title,
      snippet: result.snippet ?? "",
      ...(postedAt ? { postedAt } : {}),
      ...venueFromUrl(result.link),
    });
  }
  return hits;
}

/** SerpApi Google results from the past month. Also serves `site:reddit.com` fallback queries. */
export class SerpApiSource implements SourceAdapter {
  readonly source = "serpapi";
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly throttle = createRateLimiter(cfg.minIntervalMs);

  constructor(
    private readonly apiKey: string,
    deps: AdapterDeps = {},
  ) {
    this.fetchImpl = deps.fetch ?? fetch;
    this.now = deps.now ?? Date.now;
  }

  async search(query: string, opts?: SearchOptions): Promise<Hit[]> {
    const params = new URLSearchParams({
      engine: "google",
      q: query,
      num: String(cfg.resultsPerQuery),
      tbs: cfg.timeFilter,
      api_key: this.apiKey,
    });
    if (opts?.lang) params.set("hl", opts.lang);
    await this.throttle();
    const body = await getJSON(`${cfg.baseUrl}?${params}`, {
      source: this.source,
      timeoutMs: cfg.timeoutMs,
      fetch: this.fetchImpl,
    });
    const error = z.object({ error: z.string() }).safeParse(body);
    // "Google hasn't returned any results" is a normal empty result, not a failure.
    if (error.success && !/hasn't returned any results/i.test(error.data.error)) {
      throw new SourceError(`serpapi: ${error.data.error}`, this.source);
    }
    return mapSerpApiResponse(body, this.now());
  }
}
