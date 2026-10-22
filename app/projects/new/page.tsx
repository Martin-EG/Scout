import { ProjectForm } from "@/components/projects/ProjectForm";
import { saveProject } from "../actions";

export const metadata = { title: "New project · Scout" };

export default function NewProjectPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold">New project</h1>
      <ProjectForm action={saveProject} />
    </main>
  );
}
