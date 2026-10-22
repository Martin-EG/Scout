import "server-only";

import type { Project } from "@/types/domain";
import type { ProjectInput } from "./projectInput";
import { createServerSupabase } from "./server";

// All queries run as the signed-in user; RLS limits rows to their own projects.

export async function listProjects(): Promise<Project[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listProjects failed: ${error.message}`);
  return data;
}

export async function getProject(id: string): Promise<Project | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`getProject failed (project ${id}): ${error.message}`);
  return data;
}

export async function createProject(userId: string, input: ProjectInput): Promise<Project> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("projects")
    .insert({ ...input, user_id: userId })
    .select("*")
    .single();
  if (error) throw new Error(`createProject failed (user ${userId}): ${error.message}`);
  return data;
}

export async function updateProject(id: string, input: ProjectInput): Promise<void> {
  const supabase = await createServerSupabase();
  const { error, count } = await supabase
    .from("projects")
    .update(input, { count: "exact" })
    .eq("id", id);
  if (error) throw new Error(`updateProject failed (project ${id}): ${error.message}`);
  if (count === 0) throw new Error(`updateProject: project ${id} not found`);
}

export async function deleteProject(id: string): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(`deleteProject failed (project ${id}): ${error.message}`);
}
