import type { ServerEnv } from "@/lib/config";
import { HackerNewsSource } from "./hackernews";
import { RedditSource } from "./reddit";
import { SearxngSource } from "./searxng";
import { SerpApiSource } from "./serpapi";
import type { AdapterDeps, SourceAdapter } from "./types";

export * from "./types";
export { venueFromUrl } from "./venue";

export interface Sources {
  reddit: SourceAdapter;
  hackernews: SourceAdapter;
  searxng: SourceAdapter;
  /** Null when SERPAPI_KEY is not set: the pipeline skips it. */
  serpapi: SourceAdapter | null;
}

/** One adapter instance per source, so each keeps its own rate limiter for the run. */
export function createSources(
  env: Pick<ServerEnv, "SEARXNG_URL" | "SERPAPI_KEY">,
  deps: AdapterDeps = {},
): Sources {
  return {
    reddit: new RedditSource(deps),
    hackernews: new HackerNewsSource(deps),
    searxng: new SearxngSource(env.SEARXNG_URL, deps),
    serpapi: env.SERPAPI_KEY ? new SerpApiSource(env.SERPAPI_KEY, deps) : null,
  };
}
