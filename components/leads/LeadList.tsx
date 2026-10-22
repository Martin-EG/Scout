import type { LeadRow } from "@/lib/db/leads";

interface LeadListProps {
  leads: LeadRow[];
  dismiss: (formData: FormData) => Promise<void>;
}

const SOURCE_LABELS: Record<string, string> = {
  reddit: "Reddit",
  hackernews: "Hacker News",
  searxng: "Web (SearXNG)",
  serpapi: "Google (SerpApi)",
};

function Score({ label, value }: { label: string; value: number | null }) {
  return (
    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
      {label} <strong>{value ?? "–"}</strong>
    </span>
  );
}

/** Temporary leads list (day 2). Replaced by the inbox once drafts exist. */
export function LeadList({ leads, dismiss }: LeadListProps) {
  if (leads.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
        No open leads. Run a scout from the projects page.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {leads.map((lead) => (
        <li key={lead.id} className="flex items-start justify-between gap-4 p-4">
          <div className="min-w-0">
            <a
              href={lead.url}
              target="_blank"
              rel="noreferrer"
              className="font-medium hover:underline"
            >
              {lead.title}
            </a>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <span>{SOURCE_LABELS[lead.source] ?? lead.source}</span>
              {lead.venue_name && <span>· {lead.venue_name}</span>}
              {lead.posted_at && <span>· {lead.posted_at.slice(0, 10)}</span>}
              <Score label="intent" value={lead.intent_score} />
              <Score label="relevance" value={lead.relevance_score} />
            </div>
            {lead.reason && (
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{lead.reason}</p>
            )}
          </div>
          <form action={dismiss} className="shrink-0">
            <input type="hidden" name="id" value={lead.id} />
            <button type="submit" className="text-sm text-zinc-500 hover:text-red-600 hover:underline">
              Dismiss
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}
