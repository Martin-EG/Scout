"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import type { InboxItem } from "@/lib/db/inbox";

type Action = "approve" | "posted" | "reject";

interface InboxCardProps {
  item: InboxItem;
  act: (draftId: string, body: string, action: Action) => Promise<{ error?: string }>;
}

const SOURCE_LABELS: Record<string, string> = {
  reddit: "Reddit",
  hackernews: "Hacker News",
  searxng: "Web",
  serpapi: "Google",
};

export function InboxCard({ item, act }: InboxCardProps) {
  const { draft, lead, venue, cooldown } = item;
  const [body, setBody] = useState(draft.body);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const editable = draft.status === "pending" || draft.status === "approved";

  async function copy() {
    try {
      await navigator.clipboard.writeText(body);
      setMessage("Copied.");
    } catch {
      setMessage("Copy failed: select the text and copy it yourself.");
    }
  }

  function run(action: Action) {
    setMessage(null);
    startTransition(async () => {
      const result = await act(draft.id, body, action);
      if (result.error) setMessage(result.error);
    });
  }

  return (
    <li className="flex flex-col gap-3 p-4">
      <div className="min-w-0">
        {lead ? (
          <a href={lead.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
            {lead.title}
          </a>
        ) : (
          <p className="font-medium">{venue?.name ?? "Manual venue"}</p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          {lead && <span>{SOURCE_LABELS[lead.source] ?? lead.source}</span>}
          {venue && <span>· {lead ? venue.name : venue.platform}</span>}
          {lead?.posted_at && <span>· {lead.posted_at.slice(0, 10)}</span>}
          {lead && (
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
              intent <strong>{lead.intent_score ?? "–"}</strong> · relevance{" "}
              <strong>{lead.relevance_score ?? "–"}</strong>
            </span>
          )}
          <span>· {draft.language}</span>
          {draft.status === "approved" && <span className="text-green-700 dark:text-green-400">· approved</span>}
        </div>
        {lead?.reason && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{lead.reason}</p>}
        {!lead && venue?.why && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{venue.why}</p>}
        {venue?.rules && (
          <p className="mt-2 text-xs text-zinc-500">
            <strong>Venue rules:</strong> {venue.rules}
          </p>
        )}
        {cooldown && editable && (
          <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            You posted in {venue?.name} in the last 7 days. Consider waiting before posting there again.
          </p>
        )}
      </div>

      <textarea
        aria-label="Draft reply"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        readOnly={!editable}
        rows={6}
        className={inputClass}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={copy}>
          Copy
        </Button>
        {editable && (
          <>
            {draft.status === "pending" && (
              <Button variant="secondary" onClick={() => run("approve")} disabled={pending}>
                Approve
              </Button>
            )}
            <Button onClick={() => run("posted")} disabled={pending}>
              Mark posted
            </Button>
            <Button variant="secondary" onClick={() => run("reject")} disabled={pending}>
              Reject
            </Button>
          </>
        )}
        {draft.posted_at && <span className="text-xs text-zinc-500">Posted {draft.posted_at.slice(0, 10)}</span>}
        {message && <span className="text-sm text-zinc-600 dark:text-zinc-400">{message}</span>}
      </div>
    </li>
  );
}
