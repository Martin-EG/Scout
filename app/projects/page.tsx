import Link from "next/link";
import { Suspense } from "react";
import { DeleteProjectButton } from "@/components/projects/DeleteProjectButton";
import { ProjectStats } from "@/components/projects/ProjectStats";
import { RunPanel } from "@/components/runs/RunPanel";
import { buttonClass } from "@/components/ui/Button";
import { requireUser } from "@/lib/db/auth";
import { getProjectOverview } from "@/lib/db/inbox";
import { listProjects } from "@/lib/db/projects";
import { listRecentRuns } from "@/lib/db/runs";
import { getRecentRuns, removeProject, startRun } from "./actions";

export const metadata = { title: "Projects · Scout" };

async function ProjectList() {
  await requireUser();
  const projects = await listProjects();
  const [runs, overviews] = await Promise.all([
    Promise.all(projects.map((project) => listRecentRuns(project.id))),
    Promise.all(projects.map((project) => getProjectOverview(project.id))),
  ]);

  if (projects.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
        No projects yet. Add your app to start scouting.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {projects.map((project, i) => (
        <li key={project.id} className="flex items-start justify-between gap-4 p-4">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{project.name}</p>
            <a
              href={project.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-zinc-500 hover:underline"
            >
              {project.url}
            </a>
            {project.description && (
              <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                {project.description}
              </p>
            )}
            <ProjectStats overview={overviews[i]} />
            <RunPanel
              projectId={project.id}
              initialRuns={runs[i]}
              startRun={startRun}
              getRuns={getRecentRuns}
            />
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Link href={`/projects/${project.id}/inbox`} className="text-sm hover:underline">
              Inbox
            </Link>
            <Link href={`/projects/${project.id}/edit`} className="text-sm hover:underline">
              Edit
            </Link>
            <DeleteProjectButton
              projectId={project.id}
              projectName={project.name}
              action={removeProject}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function ProjectsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Projects</h1>
        <Link href="/projects/new" className={buttonClass()}>
          New project
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading projects…</p>}>
        <ProjectList />
      </Suspense>
    </main>
  );
}
