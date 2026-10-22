import "server-only";

import type { Lead } from "@/types/domain";
import { createServerSupabase } from "./server";

// Leads as seen by the signed-in user (RLS: only their projects' leads).

export type LeadRow = Lead & { venue_name: string | null };

/** Open (not dismissed) leads, best first: intent, then relevance. */
export async function listOpenLeads(projectId: string): Promise<LeadRow[]> {
  const supabase = await createServerSupabase();
  const [leads, venues] = await Promise.all([
    supabase
      .from("leads")
      .select("*")
      .eq("project_id", projectId)
      .neq("status", "dismissed")
      .order("intent_score", { ascending: false, nullsFirst: false })
      .order("relevance_score", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase.from("venues").select("id, name").eq("project_id", projectId),
  ]);
  if (leads.error) throw new Error(`listOpenLeads failed (project ${projectId}): ${leads.error.message}`);
  if (venues.error) throw new Error(`listOpenLeads venues failed (project ${projectId}): ${venues.error.message}`);

  const venueNames = new Map(venues.data.map((v) => [v.id, v.name]));
  return leads.data.map((lead) => ({
    ...lead,
    venue_name: lead.venue_id ? (venueNames.get(lead.venue_id) ?? null) : null,
  }));
}

export async function dismissLead(leadId: string): Promise<void> {
  const supabase = await createServerSupabase();
  const { error, count } = await supabase
    .from("leads")
    .update({ status: "dismissed" }, { count: "exact" })
    .eq("id", leadId);
  if (error) throw new Error(`dismissLead failed (lead ${leadId}): ${error.message}`);
  if (count === 0) throw new Error(`dismissLead: lead ${leadId} not found`);
}
