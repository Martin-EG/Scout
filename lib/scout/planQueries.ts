import { SCOUT } from "@/lib/config";
import type { LLMProvider } from "@/lib/llm";
import { PLAN_QUERIES_SYSTEM, planQueriesPrompt } from "@/lib/llm/prompts/planQueries";
import { queryPlanSchema, type PlannedQuery } from "@/lib/llm/schemas/queryPlan";
import type { Project } from "@/types/domain";
import { errorMessage, log, type LogContext } from "./log";

export interface QueryPlan {
  queries: PlannedQuery[];
  /** True when the LLM failed and the plan came from the project's keywords. */
  fallback: boolean;
}

/** Drops duplicate (text, source) pairs and caps the list. */
export function cleanQueries(queries: PlannedQuery[], max: number = SCOUT.maxQueries): PlannedQuery[] {
  const seen = new Set<string>();
  const out: PlannedQuery[] = [];
  for (const query of queries) {
    const key = `${query.source}:${query.text.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(query);
  }
  return out.slice(0, max);
}

/** Keyword-only plan, used when the planner model fails so the run still searches. */
export function fallbackQueries(project: Project): PlannedQuery[] {
  const why = "Project keyword (planner fallback).";
  const english = project.keywords_en.flatMap((text): PlannedQuery[] => [
    { text, lang: "en", source: "reddit", why },
    { text, lang: "en", source: "web", why },
  ]);
  const spanish = project.keywords_es.map((text): PlannedQuery => ({ text, lang: "es", source: "web", why }));
  return cleanQueries([...english, ...spanish]);
}

/** LLM turns the project profile into search queries for Reddit, HN, and the web. */
export async function planQueries(
  llm: LLMProvider,
  model: string,
  project: Project,
  ctx: LogContext,
): Promise<QueryPlan> {
  try {
    const plan = await llm.completeJSON(
      planQueriesPrompt(project, { minQueries: SCOUT.minQueries, maxQueries: SCOUT.maxQueries }),
      queryPlanSchema,
      {
        model,
        system: PLAN_QUERIES_SYSTEM,
        temperature: SCOUT.plannerTemperature,
        timeoutMs: SCOUT.plannerTimeoutMs,
      },
    );
    const queries = cleanQueries(plan.queries);
    if (queries.length < SCOUT.minQueries) {
      log.warn("planner returned fewer queries than asked", { ...ctx, count: queries.length });
    }
    return { queries, fallback: false };
  } catch (err) {
    log.error("planner failed, using keyword fallback", { ...ctx, model, error: errorMessage(err) });
    return { queries: fallbackQueries(project), fallback: true };
  }
}
