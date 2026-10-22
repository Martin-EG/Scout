import { z } from "zod";
import { SOURCES } from "@/lib/config";
import type { Hit } from "@/types/domain";
import { parseLooseDate } from "./dates";
import { getJSON } from "./http";
import { createRateLimiter } from "./rateLimit";
import { SourceError, type AdapterDeps, type SearchOptions, type SourceAdapter } from "./types";
import { venueFromUrl } from "./venue";

const cfg = SOURCES.searxng;

const responseSchema = z.object({
  results: z.array(
    z.object({
      url: z.string(),
      title: z.string(),
      content: z.string().nullish(),
      publishedDate: z.string().nullish(),
    }),
  ),
});

/** Maps a SearXNG `format=json` response to hits. Exported for fixture tests. */
export function mapSearxngResponse(body: unknown, now: number): Hit[] {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) throw new SourceError("searxng: unexpected response shape", "searxng");
  const hits: Hit[] = [];
  for (const result of parsed.data.results) {
    if (!URL.canParse(result.url)) continue;
    const postedAt = parseLooseDate(result.publishedDate, now);
    hits.push({
      source: "searxng",
      url: result.url,
      title: result.title,
      snippet: result.content ?? "",
      ...(postedAt ? { postedAt } : {}),
      ...venueFromUrl(result.url),
    });
  }
  return hits;
}

/** Self-hosted SearXNG (docker-compose.yml): general web results. */
export class SearxngSource implements SourceAdapter {
  readonly source = "searxng";
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly throttle = createRateLimiter(cfg.minIntervalMs);

  constructor(
    private readonly baseUrl: string,
    deps: AdapterDeps = {},
  ) {
    this.fetchImpl = deps.fetch ?? fetch;
    this.now = deps.now ?? Date.now;
  }

  async search(query: string, opts?: SearchOptions): Promise<Hit[]> {
    const params = new URLSearchParams({ q: query, format: "json" });
    if (opts?.lang) params.set("language", opts.lang);
    await this.throttle();
    const body = await getJSON(`${this.baseUrl.replace(/\/+$/, "")}/search?${params}`, {
      source: this.source,
      timeoutMs: cfg.timeoutMs,
      fetch: this.fetchImpl,
    });
    return mapSearxngResponse(body, this.now()).slice(0, cfg.resultsPerQuery);
  }
}
