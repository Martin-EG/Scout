const MS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;

/** "42s", "3m 05s". */
export function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return "–";
  const total = Math.round(ms / MS_PER_SECOND);
  if (total < SECONDS_PER_MINUTE) return `${total}s`;
  const minutes = Math.floor(total / SECONDS_PER_MINUTE);
  const seconds = String(total % SECONDS_PER_MINUTE).padStart(2, "0");
  return `${minutes}m ${seconds}s`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
