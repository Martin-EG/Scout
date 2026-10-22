// Pipeline persistence (worker only). Takes the service-role client: no RLS,
// so every query filters by project id explicitly.
import type { createServiceSupabase } from "./service";
import type { Database } from "@/types/database";

export type ServiceSupabase = ReturnType<typeof createServiceSupabase>;
export type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"];

export interface VenueKey {
  platform: string;
  name: string;
  url: string;
}

const venueKey = (platform: string, name: string) => `${platform}\u0000${name}`;

/** Every lead URL already stored for the project (any status, so dismissed leads stay gone). */
export async function getLeadUrls(supabase: ServiceSupabase, projectId: string): Promise<string[]> {
  const { data, error } = await supabase.from("leads").select("url").eq("project_id", projectId);
  if (error) throw new Error(`getLeadUrls failed (project ${projectId}): ${error.message}`);
  return data.map((row) => row.url);
}

/** Inserts missing venues (searchable) and returns ids keyed by platform + name. */
export async function upsertVenues(
  supabase: ServiceSupabase,
  projectId: string,
  venues: VenueKey[],
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  if (venues.length === 0) return ids;
  const unique = new Map(venues.map((v) => [venueKey(v.platform, v.name), v]));
  const rows = [...unique.values()].map((v) => ({
    project_id: projectId,
    kind: "searchable" as const,
    platform: v.platform,
    name: v.name,
    url: v.url,
  }));
  const { data, error } = await supabase
    .from("venues")
    .upsert(rows, { onConflict: "project_id,platform,name" })
    .select("id, platform, name");
  if (error) throw new Error(`upsertVenues failed (project ${projectId}): ${error.message}`);
  for (const row of data) ids.set(venueKey(row.platform, row.name), row.id);
  return ids;
}

export function venueIdFor(ids: Map<string, string>, platform: string, name: string): string | null {
  return ids.get(venueKey(platform, name)) ?? null;
}

/** Inserts leads, skipping URLs the project already has. Returns how many were new. */
export async function insertLeads(supabase: ServiceSupabase, rows: LeadInsert[]): Promise<number> {
  if (rows.length === 0) return 0;
  const { data, error } = await supabase
    .from("leads")
    .upsert(rows, { onConflict: "project_id,url", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(`insertLeads failed (project ${rows[0].project_id}): ${error.message}`);
  return data.length;
}
