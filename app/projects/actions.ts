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
