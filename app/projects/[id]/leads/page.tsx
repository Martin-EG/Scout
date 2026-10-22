import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { LeadList } from "@/components/leads/LeadList";
import { requireUser } from "@/lib/db/auth";
import { listOpenLeads } from "@/lib/db/leads";
import { getProject } from "@/lib/db/projects";
import { dismissLeadAction } from "./actions";

export const metadata = { title: "Leads · Scout" };

async function Leads({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const project = await getProject(id.data);
  if (!project) notFound();
  const leads = await listOpenLeads(project.id);

  return (
    <>
      <p className="mb-4 text-sm text-zinc-500">
        {project.name} · {leads.length} open lead{leads.length === 1 ? "" : "s"}, sorted by intent
        then relevance.
      </p>
      <LeadList leads={leads} dismiss={dismissLeadAction} />
    </>
  );
}

export default function LeadsPage({ params }: PageProps<"/projects/[id]/leads">) {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Leads</h1>
        <Link href="/projects" className="text-sm hover:underline">
          ← Projects
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading leads…</p>}>
        <Leads params={params} />
      </Suspense>
    </main>
  );
}
