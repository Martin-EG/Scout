import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { InboxCard } from "@/components/inbox/InboxCard";
import { getEnv } from "@/lib/config";
import { requireUser } from "@/lib/db/auth";
import { INBOX_TABS, listInbox, type InboxTab } from "@/lib/db/inbox";
import { getProject } from "@/lib/db/projects";
import { draftAction } from "./actions";

export const metadata = { title: "Inbox · Scout" };

const TAB_LABELS: Record<InboxTab, string> = {
  leads: "Leads",
  manual: "Manual venues",
  posted: "Posted",
  rejected: "Rejected",
};

const EMPTY: Record<InboxTab, string> = {
  leads: "No leads yet. Hit Run now and go do nothing.",
  manual: "No manual venues yet. Each run suggests a few.",
  posted: "Nothing posted yet.",
  rejected: "Nothing rejected.",
};

const tabSchema = z.enum(INBOX_TABS).catch("leads");

async function Inbox({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  await requireUser();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const project = await getProject(id.data);
  if (!project) notFound();
  const tab = tabSchema.parse((await searchParams).tab);
  const items = await listInbox(project.id, tab);
  const appUrl = getEnv().APP_URL;

  return (
    <>
      <p className="mb-4 text-sm text-zinc-500">{project.name}</p>
      <nav className="mb-4 flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {INBOX_TABS.map((t) => (
          <Link
            key={t}
            href={`/projects/${project.id}/inbox?tab=${t}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              t === tab
                ? "border-zinc-900 font-medium dark:border-zinc-100"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            {TAB_LABELS[t]}
          </Link>
        ))}
      </nav>
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          {EMPTY[tab]}
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {items.map((item) => (
            <InboxCard key={`${item.draft.id}:${item.draft.status}`} item={item} appUrl={appUrl} act={draftAction} />
          ))}
        </ul>
      )}
    </>
  );
}

export default function InboxPage({ params, searchParams }: PageProps<"/projects/[id]/inbox">) {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Inbox</h1>
        <Link href="/projects" className="text-sm hover:underline">
          ← Projects
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading inbox…</p>}>
        <Inbox params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
