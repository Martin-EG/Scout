// pnpm worker: polls for queued runs every few seconds and runs them one at a time.
import { getEnv, WORKER } from "@/lib/config";
import { claimNextRun, completeRun, failRun, failStaleRuns } from "@/lib/db/runQueue";
import { createServiceSupabase } from "@/lib/db/service";
import { createLLMProvider, getModels } from "@/lib/llm";
import { checkServices } from "@/lib/scout/health";
import { errorMessage } from "@/lib/scout/log";
import { createSources } from "@/lib/sources";
import { RunStepError, runScout, type ScoutDeps } from "./runScout";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let stopping = false;

async function processNext(deps: Omit<ScoutDeps, "sources">): Promise<boolean> {
  const claimed = await claimNextRun(deps.supabase);
  if (!claimed) return false;
  const { run, project } = claimed;
  const ctx = { projectId: project.id, runId: run.id };
  const started = Date.now();
  console.log("[worker] run started", { ...ctx, project: project.name });

  const env = getEnv();
  const problems = await checkServices({
    ollamaUrl: env.OLLAMA_BASE_URL,
    searxngUrl: env.SEARXNG_URL,
    models: Object.values(deps.models),
  });
  if (problems.length > 0) {
    console.error("[worker] services not ready, run failed", { ...ctx, problems });
    await failRun(deps.supabase, run.id, problems.join(" ")).catch((err: unknown) =>
      console.error("[worker] could not record failure", { ...ctx, error: errorMessage(err) }),
    );
    return true;
  }

  try {
    // Fresh adapters per run: rate limiters and the reddit-blocked flag start clean.
    const outcome = await runScout(project, run.id, { ...deps, sources: createSources(getEnv()) });
    await completeRun(deps.supabase, run.id, outcome);
    console.log("[worker] run done", {
      ...ctx,
      hitsFound: outcome.hitsFound,
      leadsKept: outcome.leadsKept,
      stepDurations: outcome.stepDurations,
      totalMs: Date.now() - started,
    });
  } catch (err) {
    const partial = err instanceof RunStepError ? err.partial : {};
    console.error("[worker] run failed", { ...ctx, error: errorMessage(err) });
    await failRun(deps.supabase, run.id, errorMessage(err), partial).catch((failErr: unknown) =>
      console.error("[worker] could not record failure", { ...ctx, error: errorMessage(failErr) }),
    );
  }
  return true;
}

async function main() {
  const supabase = createServiceSupabase();
  const models = getModels();
  const deps = {
    supabase,
    llm: createLLMProvider(),
    models: { planner: models.drafter, scorer: models.scorer, drafter: models.drafter },
    appUrl: getEnv().APP_URL,
  };

  const stale = await failStaleRuns(supabase, "Worker restarted while this run was in progress.");
  if (stale > 0) console.warn(`[worker] marked ${stale} stale running run(s) as failed`);
  console.log("[worker] polling for queued runs", { everyMs: WORKER.pollIntervalMs, models: deps.models });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      if (stopping) process.exit(1);
      stopping = true;
      console.log(`[worker] ${signal}: finishing the current run, then exiting (repeat to force)`);
    });
  }

  while (!stopping) {
    let didWork = false;
    try {
      didWork = await processNext(deps);
    } catch (err) {
      console.error("[worker] poll failed", { error: errorMessage(err) });
    }
    if (!didWork && !stopping) await sleep(WORKER.pollIntervalMs);
  }
}

main().catch((err: unknown) => {
  console.error("[worker] fatal", errorMessage(err));
  process.exit(1);
});
