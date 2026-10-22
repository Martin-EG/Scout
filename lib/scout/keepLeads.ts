import { SCOUT } from "@/lib/config";
import {
  insertLeads,
  upsertVenues,
  venueIdFor,
  type LeadInsert,
  type ServiceSupabase,
} from "@/lib/db/scoutStore";
import type { Hit } from "@/types/domain";
import type { ScoredHit } from "./rules";

/** Venue platform from the hit's venue, so a subreddit is "reddit" whichever source found it. */
export function platformFor(hit: Pick<Hit, "venueName" | "source">): string {
  if (hit.venueName.startsWith("r/")) return "reddit";
  if (hit.source === "hackernews") return "hackernews";
  return "web";
}

/** Upserts venues for the kept leads, then inserts the leads. Returns how many leads were new. */
export async function keepLeads(
  supabase: ServiceSupabase,
  ids: { projectId: string; runId: string },
  kept: ScoredHit[],
): Promise<number> {
  const venueIds = await upsertVenues(
    supabase,
    ids.projectId,
    kept.map((hit) => ({ platform: platformFor(hit), name: hit.venueName, url: hit.venueUrl })),
  );
  const rows: LeadInsert[] = kept.map((hit) => ({
    project_id: ids.projectId,
    run_id: ids.runId,
    venue_id: venueIdFor(venueIds, platformFor(hit), hit.venueName),
    source: hit.source,
    url: hit.url,
    title: hit.title,
    snippet: hit.snippet.slice(0, SCOUT.leadSnippetChars) || null,
    posted_at: hit.postedAt ?? null,
    relevance_score: hit.relevance,
    intent_score: hit.intent,
    reason: hit.reason || null,
  }));
  return insertLeads(supabase, rows);
}
