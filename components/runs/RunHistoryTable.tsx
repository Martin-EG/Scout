import type { RunHistoryRow } from "@/lib/db/runs";
import { formatDateTime, formatDuration } from "./format";
import { RunStatusBadge } from "./RunStatusBadge";

const SOURCE_LABELS: Record<string, string> = { reddit: "Reddit", hn: "HN", web: "Web" };

function Queries({ run }: { run: RunHistoryRow }) {
  const { items, fallback } = run.queries;
  if (items.length === 0) return <span className="text-zinc-400">–</span>;
  return (
    <details>
      <summary className="cursor-pointer">
        {items.length} queries{fallback && " (keyword fallback)"}
      </summary>
      <ul className="mt-2 flex flex-col gap-1">
        {items.map((q, i) => (
          <li key={i}>
            <span className="text-zinc-500">
              {SOURCE_LABELS[q.source] ?? q.source} · {q.lang} ·
            </span>{" "}
            {q.text} <span className="text-zinc-500">({q.hits} hits{q.ranOn.length > 0 && ` via ${q.ranOn.join(", ")}`})</span>
            {q.errors.length > 0 && <p className="text-red-600">{q.errors.join("; ")}</p>}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function RunHistoryTable({ runs }: { runs: RunHistoryRow[] }) {
  return (
    <table className="w-full text-left text-sm">
      <thead className="text-xs text-zinc-500">
        <tr>
          <th className="py-2 pr-3 font-medium">Date</th>
          <th className="py-2 pr-3 font-medium">Status</th>
          <th className="py-2 pr-3 font-medium">Duration</th>
          <th className="py-2 pr-3 font-medium">Hits</th>
          <th className="py-2 pr-3 font-medium">Leads</th>
          <th className="py-2 font-medium">Queries</th>
        </tr>
      </thead>
      <tbody>
        {runs.map((run) => (
          <tr key={run.id} className="border-t border-zinc-200 align-top dark:border-zinc-800">
            <td className="py-2 pr-3 whitespace-nowrap" suppressHydrationWarning>
              {formatDateTime(run.created_at)}
            </td>
            <td className="py-2 pr-3">
              <RunStatusBadge status={run.status} />
              {run.error && <p className="mt-1 max-w-xs break-words text-xs text-red-600">{run.error}</p>}
            </td>
            <td className="py-2 pr-3 whitespace-nowrap">{formatDuration(run.duration_ms ?? undefined)}</td>
            <td className="py-2 pr-3">{run.hits_found}</td>
            <td className="py-2 pr-3">{run.leads_kept}</td>
            <td className="py-2 text-xs">
              <Queries run={run} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
