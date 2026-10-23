import "server-only";

import { z } from "zod";
import { QUOTAS, RUNS_UI } from "@/lib/config";
import type { Run, StepDurations } from "@/types/domain";
import { createServerSupabase } from "./server";

// Runs as seen by the signed-in user (RLS: only their projects' runs).

export type RunSummary = Pick<
  Run,
  "id" | "status" | "created_at" | "started_at" | "finished_at" | "hits_found" | "leads_kept" | "error"
> & { step_durations: StepDurations };

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
  return data.map((row) => ({ ...row, step_durations: durationsSchema.parse(row.step_durations) }));
}

export type QueueRunResult = { ok: true } | { ok: false; reason: "quota" | "active" };

function startOfUtcDay(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

/**
 * Inserts a queued run unless the user hit the daily quota (counted across all
 * their projects, UTC day) or the project already has a queued/running run.
 */
export async function queueRun(projectId: string): Promise<QueueRunResult> {
  const supabase = await createServerSupabase();

  const { count: today, error: quotaError } = await supabase
    .from("runs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", startOfUtcDay(new Date()));
  if (quotaError) throw new Error(`queueRun quota check failed: ${quotaError.message}`);
  if ((today ?? 0) >= QUOTAS.runsPerUserPerDay) return { ok: false, reason: "quota" };

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
