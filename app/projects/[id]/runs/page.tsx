import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { RunHistoryTable } from "@/components/runs/RunHistoryTable";
import { requireUser } from "@/lib/db/auth";
import { getProject } from "@/lib/db/projects";
import { listRunHistory } from "@/lib/db/runs";

export const metadata = { title: "Run history · Scout" };

async function History({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const project = await getProject(id.data);
  if (!project) notFound();
  const runs = await listRunHistory(project.id);

  return (
    <>
      <p className="mb-4 text-sm text-zinc-500">{project.name}</p>
      {runs.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No runs yet. Press Run now on the projects page.
        </p>
      ) : (
        <RunHistoryTable runs={runs} />
      )}
    </>
  );
}

export default function RunHistoryPage({ params }: PageProps<"/projects/[id]/runs">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Run history</h1>
        <Link href="/projects" className="text-sm hover:underline">
          ← Projects
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading runs…</p>}>
        <History params={params} />
      </Suspense>
    </main>
  );
}
