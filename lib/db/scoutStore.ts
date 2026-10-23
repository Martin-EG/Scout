// Pipeline persistence (worker only). Takes the service-role client: no RLS,
// so every query filters by project id explicitly.
import type { createServiceSupabase } from "./service";
import type { Database } from "@/types/database";
import type { Lead, Venue } from "@/types/domain";

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

export type LeadToDraft = Pick<Lead, "id" | "title" | "snippet" | "url" | "source" | "posted_at" | "intent_score"> & {
  venue: Pick<Venue, "id" | "name" | "rules" | "link_policy"> | null;
};

/** Leads still waiting for a draft (status new), highest intent first. */
export async function listLeadsToDraft(
  supabase: ServiceSupabase,
  projectId: string,
  limit: number,
): Promise<LeadToDraft[]> {
  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, title, snippet, url, source, posted_at, intent_score, relevance_score, venue_id")
    .eq("project_id", projectId)
    .eq("status", "new")
    .order("intent_score", { ascending: false, nullsFirst: false })
    .order("relevance_score", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(`listLeadsToDraft failed (project ${projectId}): ${error.message}`);

  const venueIds = [...new Set(leads.flatMap((l) => (l.venue_id ? [l.venue_id] : [])))];
  const venues = new Map<string, LeadToDraft["venue"]>();
  if (venueIds.length > 0) {
    const { data, error: venueError } = await supabase
      .from("venues")
      .select("id, name, rules, link_policy")
      .in("id", venueIds);
    if (venueError) throw new Error(`listLeadsToDraft venues failed (project ${projectId}): ${venueError.message}`);
    for (const venue of data) venues.set(venue.id, venue);
  }
  return leads.map(({ venue_id, ...lead }) => ({
    ...lead,
    venue: venue_id ? (venues.get(venue_id) ?? null) : null,
  }));
}

export type DraftInsert = Database["public"]["Tables"]["drafts"]["Insert"];

/** Saves a lead's draft and marks the lead drafted. */
export async function saveLeadDraft(supabase: ServiceSupabase, draft: DraftInsert & { lead_id: string }) {
  const { error } = await supabase.from("drafts").insert(draft);
  if (error) throw new Error(`saveLeadDraft insert failed (lead ${draft.lead_id}): ${error.message}`);
  const { error: leadError } = await supabase.from("leads").update({ status: "drafted" }).eq("id", draft.lead_id);
  if (leadError) throw new Error(`saveLeadDraft lead update failed (lead ${draft.lead_id}): ${leadError.message}`);
}

/** Lowercased names of every venue the project already has (any kind). */
export async function listVenueNames(supabase: ServiceSupabase, projectId: string): Promise<string[]> {
  const { data, error } = await supabase.from("venues").select("name").eq("project_id", projectId);
  if (error) throw new Error(`listVenueNames failed (project ${projectId}): ${error.message}`);
  return data.map((v) => v.name);
}

export interface ManualVenueInsert {
  platform: string;
  name: string;
  why: string;
  draft: string;
  language: string;
}

/** Inserts manual venues and one pending draft each. Returns how many venues were added. */
export async function insertManualVenues(
  supabase: ServiceSupabase,
  projectId: string,
  venues: ManualVenueInsert[],
): Promise<number> {
  if (venues.length === 0) return 0;
  const { data, error } = await supabase
    .from("venues")
    .upsert(
      venues.map((v) => ({ project_id: projectId, kind: "manual" as const, platform: v.platform, name: v.name, why: v.why })),
      { onConflict: "project_id,platform,name", ignoreDuplicates: true },
    )
    .select("id, platform, name");
  if (error) throw new Error(`insertManualVenues failed (project ${projectId}): ${error.message}`);

  const byKey = new Map(venues.map((v) => [venueKey(v.platform, v.name), v]));
  const drafts = data.flatMap((row) => {
    const venue = byKey.get(venueKey(row.platform, row.name));
    return venue
      ? [{ project_id: projectId, venue_id: row.id, body: venue.draft, language: venue.language }]
      : [];
  });
  if (drafts.length > 0) {
    const { error: draftError } = await supabase.from("drafts").insert(drafts);
    if (draftError) throw new Error(`insertManualVenues drafts failed (project ${projectId}): ${draftError.message}`);
  }
  return data.length;
}
