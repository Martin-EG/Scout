import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { requireUser } from "@/lib/db/auth";
import { getProject } from "@/lib/db/projects";
import { saveProject } from "../../actions";

export const metadata = { title: "Edit project · Scout" };

async function EditForm({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const project = await getProject(id.data);
  if (!project) notFound();
  return <ProjectForm action={saveProject} project={project} />;
}

export default function EditProjectPage({ params }: PageProps<"/projects/[id]/edit">) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold">Edit project</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <EditForm params={params} />
      </Suspense>
    </main>
  );
}
