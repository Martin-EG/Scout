// Run queue for the worker (service-role client, no RLS).
import type { Json } from "@/types/database";
import type { Project, Run, StepDurations } from "@/types/domain";
import type { ServiceSupabase } from "./scoutStore";

export interface ClaimedRun {
  run: Pick<Run, "id" | "project_id">;
  project: Project;
}

/**
 * Takes the oldest queued run and marks it running. The status guard on the
 * update means two workers can never claim the same run.
 */
export async function claimNextRun(supabase: ServiceSupabase): Promise<ClaimedRun | null> {
  const { data: next, error } = await supabase
    .from("runs")
    .select("id, project_id")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`claimNextRun select failed: ${error.message}`);
  if (!next) return null;

  const { data: claimed, error: claimError } = await supabase
    .from("runs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", next.id)
    .eq("status", "queued")
    .select("id, project_id")
    .maybeSingle();
  if (claimError) throw new Error(`claimNextRun update failed (run ${next.id}): ${claimError.message}`);
  if (!claimed) return null;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", claimed.project_id)
    .single();
  if (projectError) {
    throw new Error(`claimNextRun project load failed (run ${claimed.id}): ${projectError.message}`);
  }
  return { run: claimed, project };
}

export interface RunOutcome {
  queries: Json;
  hitsFound: number;
  leadsKept: number;
  stepDurations: StepDurations;
}

export async function completeRun(supabase: ServiceSupabase, runId: string, outcome: RunOutcome) {
  const { error } = await supabase
    .from("runs")
    .update({
      status: "done",
      finished_at: new Date().toISOString(),
      queries: outcome.queries,
      hits_found: outcome.hitsFound,
      leads_kept: outcome.leadsKept,
      step_durations: outcome.stepDurations,
      error: null,
    })
    .eq("id", runId);
  if (error) throw new Error(`completeRun failed (run ${runId}): ${error.message}`);
}

export async function failRun(
  supabase: ServiceSupabase,
  runId: string,
  message: string,
  partial: Partial<RunOutcome> = {},
) {
  const { error } = await supabase
    .from("runs")
    .update({
      status: "failed",
      finished_at: new Date().toISOString(),
      error: message,
      ...(partial.queries !== undefined ? { queries: partial.queries } : {}),
      ...(partial.hitsFound !== undefined ? { hits_found: partial.hitsFound } : {}),
      ...(partial.leadsKept !== undefined ? { leads_kept: partial.leadsKept } : {}),
      ...(partial.stepDurations ? { step_durations: partial.stepDurations } : {}),
    })
    .eq("id", runId);
  if (error) throw new Error(`failRun failed (run ${runId}): ${error.message}`);
}

/** Runs left "running" by a crashed worker. Called once at worker start (one worker at a time). */
export async function failStaleRuns(supabase: ServiceSupabase, message: string): Promise<number> {
  const { data, error } = await supabase
    .from("runs")
    .update({ status: "failed", finished_at: new Date().toISOString(), error: message })
    .eq("status", "running")
    .select("id");
  if (error) throw new Error(`failStaleRuns failed: ${error.message}`);
  return data.length;
}
