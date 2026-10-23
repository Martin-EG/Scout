import { formatDateTime } from "@/components/runs/format";
import type { ProjectOverview } from "@/lib/db/inbox";

export function ProjectStats({ overview }: { overview: ProjectOverview }) {
  return (
    <p className="mt-2 text-xs text-zinc-500" suppressHydrationWarning>
      {overview.newDrafts} new draft{overview.newDrafts === 1 ? "" : "s"} · {overview.postedThisWeek} posted this
      week · last run {overview.lastRunAt ? formatDateTime(overview.lastRunAt) : "never"}
    </p>
  );
}
