// One scout run: plan -> search -> dedupe -> score -> keep. Each step is timed.
import type { LLMProvider } from "@/lib/llm";
import { getLeadUrls, type ServiceSupabase } from "@/lib/db/scoutStore";
import type { RunOutcome } from "@/lib/db/runQueue";
import type { Sources } from "@/lib/sources";
import { dedupeHits, normalizeUrl } from "@/lib/scout/dedupe";
import { keepLeads } from "@/lib/scout/keepLeads";
import { buildKeywordIndex, matchesKeywords } from "@/lib/scout/keywords";
import { errorMessage, log, type LogContext } from "@/lib/scout/log";
import { planQueries } from "@/lib/scout/planQueries";
import { applyScoreRules, isSkippedDomain, selectHitsToScore } from "@/lib/scout/rules";
import { scoreHits } from "@/lib/scout/score";
import { searchAll } from "@/lib/scout/search";
import type { Project, RunStep, StepDurations } from "@/types/domain";

export interface ScoutDeps {
  supabase: ServiceSupabase;
  llm: LLMProvider;
  sources: Sources;
  models: { planner: string; scorer: string };
  now?: () => number;
}

/** Thrown when a step fails; carries what finished so the run row still records it. */
export class RunStepError extends Error {
  readonly name = "RunStepError";
  constructor(
    message: string,
    readonly partial: Partial<RunOutcome>,
  ) {
    super(message);
  }
}

export async function runScout(project: Project, runId: string, deps: ScoutDeps): Promise<RunOutcome> {
  const now = deps.now ?? Date.now;
  const ctx: LogContext = { projectId: project.id, runId };
  const durations: StepDurations = {};
  const outcome: Partial<RunOutcome> = { stepDurations: durations };

  async function step<T>(name: RunStep, fn: () => Promise<T>): Promise<T> {
    const started = now();
    try {
      return await fn();
    } catch (err) {
      throw new RunStepError(`${name} step failed: ${errorMessage(err)}`, outcome);
    } finally {
      durations[name] = now() - started;
    }
  }

  try {
    return await pipeline();
  } catch (err) {
    if (err instanceof RunStepError) throw err;
    throw new RunStepError(errorMessage(err), outcome);
  }

  async function pipeline(): Promise<RunOutcome> {
    const plan = await step("plan", () => planQueries(deps.llm, deps.models.planner, project, ctx));
    log.info("planned queries", { ...ctx, count: plan.queries.length, fallback: plan.fallback });

    const search = await step("search", () => searchAll(plan.queries, deps.sources, ctx));
    outcome.queries = { fallback: plan.fallback, items: search.queries };
    outcome.hitsFound = search.hits.length;

    const existing = new Set((await getLeadUrls(deps.supabase, project.id)).map(normalizeUrl));
    const fresh = dedupeHits(search.hits, existing);
    const keywords = buildKeywordIndex(project);
    const candidates = fresh.filter((hit) => !isSkippedDomain(hit, project.url) && matchesKeywords(hit, keywords));
    const toScore = selectHitsToScore(candidates, now());
    log.info("searched", {
      ...ctx,
      hits: search.hits.length,
      unique: fresh.length,
      onTopic: candidates.length,
      toScore: toScore.length,
    });

    const { scored, stats } = await step("score", () =>
      scoreHits(deps.llm, deps.models.scorer, project, toScore, ctx),
    );
    const kept = applyScoreRules(scored, now());
    outcome.leadsKept = await keepLeads(deps.supabase, { projectId: project.id, runId }, kept);
    log.info("scored", { ...ctx, ...stats, scored: scored.length, kept: kept.length, stored: outcome.leadsKept });

    return {
      queries: outcome.queries,
      hitsFound: outcome.hitsFound,
      leadsKept: outcome.leadsKept,
      stepDurations: durations,
    };
  }
}
