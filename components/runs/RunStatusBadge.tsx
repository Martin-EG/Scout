import type { RunStatus } from "@/types/domain";

const styles: Record<RunStatus, string> = {
  queued: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  running: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  done: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export function RunStatusBadge({ status }: { status: RunStatus }) {
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {status === "running" ? "running…" : status}
    </span>
  );
}
