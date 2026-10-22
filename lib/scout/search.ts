import { SOURCES } from "@/lib/config";
import type { PlannedQuery, QuerySource } from "@/lib/llm/schemas/queryPlan";
import { SourceBlockedError, type SourceAdapter, type Sources } from "@/lib/sources";
import type { Hit, HitSource } from "@/types/domain";
import { errorMessage, log, type LogContext } from "./log";

/** What happened to one planned query; stored on the run (runs.queries). */
export type QueryResult = PlannedQuery & {
  ranOn: HitSource[];
  hits: number;
  errors: string[];
};

export interface SearchResult {
  hits: Hit[];
  queries: QueryResult[];
}

const REDDIT_SITE = "site:reddit.com";

async function runOne(
  adapter: SourceAdapter,
  text: string,
  query: QueryResult,
  hits: Hit[],
  ctx: LogContext,
): Promise<void> {
  query.ranOn.push(adapter.source);
  try {
    const found = await adapter.search(text, { lang: query.lang });
    query.hits += found.length;
    hits.push(...found);
  } catch (err) {
    query.errors.push(`${adapter.source}: ${errorMessage(err)}`);
    log.warn("source query failed", { ...ctx, source: adapter.source, query: text, error: errorMessage(err) });
    throw err;
  }
}

/** Reddit lane. After the first 403/429, remaining queries go to SerpApi as site:reddit.com. */
async function redditLane(queries: QueryResult[], sources: Sources, hits: Hit[], ctx: LogContext) {
  let blocked = false;
  for (const query of queries) {
    if (!blocked) {
      try {
        await runOne(sources.reddit, query.text, query, hits, ctx);
        continue;
      } catch (err) {
        if (!(err instanceof SourceBlockedError)) continue;
        blocked = true;
        log.warn("reddit blocked, falling back to SerpApi site:reddit.com", { ...ctx, source: "reddit" });
      }
    }
    if (sources.serpapi) {
      await runOne(sources.serpapi, `${REDDIT_SITE} ${query.text}`, query, hits, ctx).catch(() => undefined);
    }
  }
}

/** Web lane: every query on SearXNG, the first few also on SerpApi (metered). */
async function webLane(queries: QueryResult[], sources: Sources, hits: Hit[], ctx: LogContext) {
  let serpBudget = SOURCES.serpapi.maxWebQueriesPerRun;
  for (const query of queries) {
    await runOne(sources.searxng, query.text, query, hits, ctx).catch(() => undefined);
    if (sources.serpapi && serpBudget > 0) {
      serpBudget--;
      await runOne(sources.serpapi, query.text, query, hits, ctx).catch(() => undefined);
    }
  }
}

async function hnLane(queries: QueryResult[], sources: Sources, hits: Hit[], ctx: LogContext) {
  for (const query of queries) {
    await runOne(sources.hackernews, query.text, query, hits, ctx).catch(() => undefined);
  }
}

/**
 * Runs every planned query on its source. Lanes (reddit, web, hn) run in
 * parallel; queries inside a lane run in order, and each adapter rate-limits
 * itself. A failing query is recorded and skipped, never fatal.
 */
export async function searchAll(plan: PlannedQuery[], sources: Sources, ctx: LogContext): Promise<SearchResult> {
  const queries: QueryResult[] = plan.map((q) => ({ ...q, ranOn: [], hits: 0, errors: [] }));
  const lane = (source: QuerySource) => queries.filter((q) => q.source === source);
  const hits: Hit[] = [];

  await Promise.all([
    redditLane(lane("reddit"), sources, hits, ctx),
    webLane(lane("web"), sources, hits, ctx),
    hnLane(lane("hn"), sources, hits, ctx),
  ]);

  return { hits, queries };
}
