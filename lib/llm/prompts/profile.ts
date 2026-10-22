import type { Project } from "@/types/domain";

type ProjectProfile = Pick<
  Project,
  "name" | "url" | "description" | "audience" | "problems" | "keywords_en" | "keywords_es" | "region"
>;

/** The project as a compact block the models can read. Empty fields are left out. */
export function formatProjectProfile(project: ProjectProfile): string {
  const lines = [
    `Name: ${project.name}`,
    `URL: ${project.url}`,
    project.description && `What it does: ${project.description}`,
    project.audience && `Audience: ${project.audience}`,
    project.problems && `Problems it solves: ${project.problems}`,
    project.keywords_en.length > 0 && `English keywords: ${project.keywords_en.join(", ")}`,
    project.keywords_es.length > 0 && `Spanish keywords: ${project.keywords_es.join(", ")}`,
    project.region && `Region: ${project.region}`,
  ];
  return lines.filter(Boolean).join("\n");
}
