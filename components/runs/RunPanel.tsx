"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { QUOTAS, RUNS_UI } from "@/lib/config";
import type { RunSummary } from "@/lib/db/runs";
import { formatDateTime, formatDuration } from "./format";
import { RunStatusBadge } from "./RunStatusBadge";

interface RunsState {
  runs: RunSummary[];
  runsLeft: number;
}

interface RunPanelProps {
  projectId: string;
  initialState: RunsState;
  startRun: (projectId: string) => Promise<{ error?: string; queued?: boolean }>;
  getRuns: (projectId: string) => Promise<RunsState>;
}

const isActive = (run: RunSummary) => run.status === "queued" || run.status === "running";

const draftAndVenues = (run: RunSummary) =>
  run.step_durations.draft === undefined ? undefined : run.step_durations.draft + (run.step_durations.venues ?? 0);

/** "Run now", runs left today, and the project's recent runs. Polls while any run is queued or running. */
export function RunPanel({ projectId, initialState, startRun, getRuns }: RunPanelProps) {
  const [state, setState] = useState(initialState);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { runs, runsLeft } = state;
  const polling = runs.some(isActive);

  const reload = useCallback(async () => {
    try {
      setState(await getRuns(projectId));
    } catch {
      // Transient (network, deploy); the next poll tries again.
    }
  }, [getRuns, projectId]);

  useEffect(() => {
    if (!polling) return;
    const timer = setInterval(reload, RUNS_UI.pollIntervalMs);
    return () => clearInterval(timer);
  }, [polling, reload]);

  function onRunNow() {
    setError(null);
    startTransition(async () => {
      const result = await startRun(projectId);
      if (result.error) setError(result.error);
      await reload();
    });
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={onRunNow} disabled={pending || polling || runsLeft === 0}>
          {pending ? "Queueing…" : polling ? "Running…" : "Run now"}
        </Button>
        <span className="text-xs text-zinc-500">
          {runsLeft} of {QUOTAS.runsPerUserPerDay} runs left today
        </span>
        <Link href={`/projects/${projectId}/runs`} className="text-xs text-zinc-500 hover:underline">
          Run history
        </Link>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      {runs.some((run) => run.waiting_for_worker) && (
        <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Still queued. Is the worker running? Start it with <code>pnpm worker</code>.
        </p>
      )}
      {runs.length === 0 ? (
        <p className="text-xs text-zinc-500">No runs yet. Run now searches for people who need this app.</p>
      ) : (
        <table className="w-full text-left text-xs text-zinc-600 dark:text-zinc-400">
          <thead className="text-zinc-500">
            <tr>
              <th className="py-1 pr-3 font-medium">Started</th>
              <th className="py-1 pr-3 font-medium">Status</th>
              <th className="py-1 pr-3 font-medium">Hits</th>
              <th className="py-1 pr-3 font-medium">Leads</th>
              <th className="py-1 font-medium">Plan / search / score / draft</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} className="border-t border-zinc-100 align-top dark:border-zinc-800">
                <td className="py-1 pr-3" suppressHydrationWarning>
                  {formatDateTime(run.started_at ?? run.created_at)}
                </td>
                <td className="py-1 pr-3">
                  <RunStatusBadge status={run.status} />
                  {run.error && (
                    <p className="mt-1 max-w-xs break-words text-red-600" title={run.error}>
                      {run.error}
                    </p>
                  )}
                </td>
                <td className="py-1 pr-3">{run.hits_found}</td>
                <td className="py-1 pr-3">{run.leads_kept}</td>
                <td className="py-1">
                  {formatDuration(run.step_durations.plan)} / {formatDuration(run.step_durations.search)} /{" "}
                  {formatDuration(run.step_durations.score)} / {formatDuration(draftAndVenues(run))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
