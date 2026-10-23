"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/db/auth";
import {
  fieldErrorsFrom,
  projectInputFromFormData,
  projectInputSchema,
} from "@/lib/db/projectInput";
import { createProject, deleteProject, updateProject } from "@/lib/db/projects";
import { listRecentRuns, queueRun, runsLeftToday, type RunSummary } from "@/lib/db/runs";
import { QUOTAS } from "@/lib/config";
import type { ProjectFormState } from "@/components/projects/ProjectForm";

const idSchema = z.uuid();

export async function saveProject(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const user = await requireUser();
  const rawId = formData.get("id");
  const id = rawId ? idSchema.safeParse(rawId) : null;
  if (id && !id.success) return { formError: "Invalid project id." };

  const values = projectInputFromFormData(formData);
  const parsed = projectInputSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };

  try {
    if (id) await updateProject(id.data, parsed.data);
    else await createProject(user.id, parsed.data);
  } catch (err) {
    console.error("[projects] save failed", { userId: user.id, projectId: id?.data, err });
    return { formError: "Could not save the project. Try again.", values };
  }
  redirect("/projects");
}

export async function removeProject(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = idSchema.parse(formData.get("id"));
  try {
    await deleteProject(id);
  } catch (err) {
    console.error("[projects] delete failed", { userId: user.id, projectId: id, err });
    throw new Error("Could not delete the project.");
  }
  redirect("/projects");
}

export type StartRunState = { error?: string; queued?: boolean };

const QUEUE_ERRORS = {
  quota: `Daily limit reached (${QUOTAS.runsPerUserPerDay} runs per day; failed runs don't count). Try again tomorrow (UTC).`,
  active: "This project already has a run queued or in progress.",
} as const;

export async function startRun(projectId: string): Promise<StartRunState> {
  const user = await requireUser();
  const id = idSchema.safeParse(projectId);
  if (!id.success) return { error: "Invalid project id." };
  try {
    const result = await queueRun(id.data);
    return result.ok ? { queued: true } : { error: QUEUE_ERRORS[result.reason] };
  } catch (err) {
    console.error("[runs] queue failed", { userId: user.id, projectId: id.data, err });
    return { error: "Could not start the run. Try again." };
  }
}

export interface RunsState {
  runs: RunSummary[];
  runsLeft: number;
}

export async function getRecentRuns(projectId: string): Promise<RunsState> {
  await requireUser();
  const [runs, runsLeft] = await Promise.all([listRecentRuns(idSchema.parse(projectId)), runsLeftToday()]);
  return { runs, runsLeft };
}
