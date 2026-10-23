import "server-only";

import { isInCooldown } from "@/lib/cooldown";
import type { Draft, DraftStatus, Lead, Venue } from "@/types/domain";
import { createServerSupabase } from "./server";

// Drafts as seen by the signed-in user (RLS: only their projects' rows).

export const INBOX_TABS = ["leads", "manual", "posted", "rejected"] as const;
export type InboxTab = (typeof INBOX_TABS)[number];

export interface InboxItem {
  draft: Draft;
  lead: Lead | null;
  venue: Venue | null;
  /** The venue was posted in within VENUE_COOLDOWN_DAYS. */
  cooldown: boolean;
}

const TAB_STATUSES: Record<InboxTab, DraftStatus[]> = {
  leads: ["pending", "approved"],
  manual: ["pending", "approved"],
  posted: ["posted"],
  rejected: ["rejected"],
};

export async function listInbox(projectId: string, tab: InboxTab): Promise<InboxItem[]> {
  const supabase = await createServerSupabase();
  let query = supabase
    .from("drafts")
    .select("*")
    .eq("project_id", projectId)
    .in("status", TAB_STATUSES[tab])
    .order("created_at", { ascending: false });
  if (tab === "leads") query = query.not("lead_id", "is", null);
  if (tab === "manual") query = query.is("lead_id", null);
  const { data: drafts, error } = await query;
  if (error) throw new Error(`listInbox failed (project ${projectId}, tab ${tab}): ${error.message}`);

  const leadIds = drafts.flatMap((d) => (d.lead_id ? [d.lead_id] : []));
  const venueIds = drafts.flatMap((d) => (d.venue_id ? [d.venue_id] : []));
  const [leads, venues] = await Promise.all([
    leadIds.length > 0 ? supabase.from("leads").select("*").in("id", leadIds) : null,
    venueIds.length > 0 ? supabase.from("venues").select("*").in("id", [...new Set(venueIds)]) : null,
  ]);
  if (leads?.error) throw new Error(`listInbox leads failed (project ${projectId}): ${leads.error.message}`);
  if (venues?.error) throw new Error(`listInbox venues failed (project ${projectId}): ${venues.error.message}`);
  const leadById = new Map((leads?.data ?? []).map((l) => [l.id, l]));
  const venueById = new Map((venues?.data ?? []).map((v) => [v.id, v]));

  const now = Date.now();
  const items = drafts.map((draft) => {
    const venue = draft.venue_id ? (venueById.get(draft.venue_id) ?? null) : null;
    return {
      draft,
      lead: draft.lead_id ? (leadById.get(draft.lead_id) ?? null) : null,
      venue,
      cooldown: isInCooldown(venue?.last_posted_at, now),
    };
  });
  // Lead drafts: best leads first, like the run's scoring order.
  if (tab === "leads") {
    items.sort(
      (a, b) =>
        (b.lead?.intent_score ?? 0) - (a.lead?.intent_score ?? 0) ||
        (b.lead?.relevance_score ?? 0) - (a.lead?.relevance_score ?? 0),
    );
  }
  return items;
}

export type DraftAction = "approve" | "posted" | "reject";

const ACTION_STATUS: Record<DraftAction, DraftStatus> = { approve: "approved", posted: "posted", reject: "rejected" };

/**
 * Saves the edited body and applies the action. Mark posted also stamps the
 * draft's posted_at and its venue's last_posted_at (drives the cooldown warning).
 */
export async function applyDraftAction(draftId: string, body: string, action: DraftAction): Promise<void> {
  const supabase = await createServerSupabase();
  const now = new Date().toISOString();
  const { data: draft, error } = await supabase
    .from("drafts")
    .update({ body, status: ACTION_STATUS[action], ...(action === "posted" ? { posted_at: now } : {}) })
    .eq("id", draftId)
    .select("venue_id")
    .maybeSingle();
  if (error) throw new Error(`applyDraftAction failed (draft ${draftId}, ${action}): ${error.message}`);
  if (!draft) throw new Error(`applyDraftAction: draft ${draftId} not found`);

  if (action === "posted" && draft.venue_id) {
    const { error: venueError } = await supabase
      .from("venues")
      .update({ last_posted_at: now })
      .eq("id", draft.venue_id);
    if (venueError) throw new Error(`applyDraftAction venue failed (venue ${draft.venue_id}): ${venueError.message}`);
  }
}

export interface ProjectOverview {
  newDrafts: number;
  postedThisWeek: number;
  lastRunAt: string | null;
}

const WEEK_MS = 7 * 86_400_000;

export async function getProjectOverview(projectId: string): Promise<ProjectOverview> {
  const supabase = await createServerSupabase();
  const weekAgo = new Date(Date.now() - WEEK_MS).toISOString();
  const [pending, posted, lastRun] = await Promise.all([
    supabase.from("drafts").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("status", "pending"),
    supabase
      .from("drafts")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("status", "posted")
      .gte("posted_at", weekAgo),
    supabase
      .from("runs")
      .select("created_at, started_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  for (const result of [pending, posted, lastRun]) {
    if (result.error) throw new Error(`getProjectOverview failed (project ${projectId}): ${result.error.message}`);
  }
  return {
    newDrafts: pending.count ?? 0,
    postedThisWeek: posted.count ?? 0,
    lastRunAt: lastRun.data ? (lastRun.data.started_at ?? lastRun.data.created_at) : null,
  };
}
