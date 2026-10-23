import "server-only";

import { z } from "zod";
import { QUOTAS, RUNS_UI } from "@/lib/config";
import type { Run, StepDurations } from "@/types/domain";
import { createServerSupabase } from "./server";

// Runs as seen by the signed-in user (RLS: only their projects' runs).

export type RunSummary = Pick<
  Run,
  "id" | "status" | "created_at" | "started_at" | "finished_at" | "hits_found" | "leads_kept" | "error"
> & {
  step_durations: StepDurations;
  /** Queued for longer than RUNS_UI.workerHintAfterMs: the worker is probably not running. */
  waiting_for_worker: boolean;
};

const durationsSchema = z
  .object({ plan: z.number(), search: z.number(), score: z.number(), draft: z.number(), venues: z.number() })
  .partial()
  .catch({});

const SUMMARY_COLUMNS =
  "id, status, created_at, started_at, finished_at, hits_found, leads_kept, error, step_durations";

export async function listRecentRuns(
  projectId: string,
  limit: number = RUNS_UI.recentRunsShown,
): Promise<RunSummary[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("runs")
    .select(SUMMARY_COLUMNS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listRecentRuns failed (project ${projectId}): ${error.message}`);
  const now = Date.now();
  return data.map((row) => ({
    ...row,
    step_durations: durationsSchema.parse(row.step_durations),
    waiting_for_worker: row.status === "queued" && now - Date.parse(row.created_at) > RUNS_UI.workerHintAfterMs,
  }));
}

const runQueriesSchema = z
  .object({
    fallback: z.boolean().catch(false),
    items: z.array(
      z.object({
        text: z.string(),
        lang: z.string().catch(""),
        source: z.string().catch(""),
        why: z.string().catch(""),
        ranOn: z.array(z.string()).catch([]),
        hits: z.number().catch(0),
        errors: z.array(z.string()).catch([]),
      }),
    ),
  })
  .catch({ fallback: false, items: [] });

export type RunQueries = z.infer<typeof runQueriesSchema>;

export type RunHistoryRow = RunSummary & { queries: RunQueries; duration_ms: number | null };

const HISTORY_LIMIT = 50;

/** Up to 50 most recent runs with their queries and total duration. */
export async function listRunHistory(projectId: string): Promise<RunHistoryRow[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("runs")
    .select(`${SUMMARY_COLUMNS}, queries`)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) throw new Error(`listRunHistory failed (project ${projectId}): ${error.message}`);
  const now = Date.now();
  return data.map((row) => ({
    ...row,
    step_durations: durationsSchema.parse(row.step_durations),
    waiting_for_worker: row.status === "queued" && now - Date.parse(row.created_at) > RUNS_UI.workerHintAfterMs,
    queries: runQueriesSchema.parse(row.queries),
    duration_ms:
      row.started_at && row.finished_at ? Date.parse(row.finished_at) - Date.parse(row.started_at) : null,
  }));
}

export type QueueRunResult = { ok: true } | { ok: false; reason: "quota" | "active" };

function startOfUtcDay(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

/** Runs the user can still start today (UTC), across all their projects. Failed runs are free. */
export async function runsLeftToday(): Promise<number> {
  const supabase = await createServerSupabase();
  const { count, error } = await supabase
    .from("runs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", startOfUtcDay(new Date()))
    .neq("status", "failed");
  if (error) throw new Error(`runsLeftToday failed: ${error.message}`);
  return Math.max(0, QUOTAS.runsPerUserPerDay - (count ?? 0));
}

/**
 * Inserts a queued run unless the user hit the daily quota (counted across all
 * their projects, UTC day) or the project already has a queued/running run.
 */
export async function queueRun(projectId: string): Promise<QueueRunResult> {
  const supabase = await createServerSupabase();

  if ((await runsLeftToday()) <= 0) return { ok: false, reason: "quota" };

  const { count: active, error: activeError } = await supabase
    .from("runs")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .in("status", ["queued", "running"]);
  if (activeError) throw new Error(`queueRun active check failed (project ${projectId}): ${activeError.message}`);
  if ((active ?? 0) > 0) return { ok: false, reason: "active" };

  const { error } = await supabase.from("runs").insert({ project_id: projectId });
  if (error) throw new Error(`queueRun insert failed (project ${projectId}): ${error.message}`);
  return { ok: true };
}
