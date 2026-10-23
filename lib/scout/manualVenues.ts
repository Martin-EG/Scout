import { DRAFTS } from "@/lib/config";
import { insertManualVenues, listVenueNames, type ServiceSupabase } from "@/lib/db/scoutStore";
import type { LLMProvider } from "@/lib/llm";
import { MANUAL_VENUES_SYSTEM, manualVenuesPrompt } from "@/lib/llm/prompts/manualVenues";
import { manualVenuesSchema, type ManualVenueOutput } from "@/lib/llm/schemas/draft";
import type { Project } from "@/types/domain";
import { draftProblems } from "./draft";
import { errorMessage, log, type LogContext } from "./log";

/**
 * Keeps suggestions whose name is new for the project (case-insensitive, also
 * within the batch) and whose draft meets the product rules; caps the list.
 */
export function selectNewVenues(suggestions: ManualVenueOutput[], existingNames: string[]): ManualVenueOutput[] {
  const seen = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  const out: ManualVenueOutput[] = [];
  for (const venue of suggestions) {
    const key = venue.name.trim().toLowerCase();
    if (seen.has(key) || draftProblems(venue.draft).length > 0) continue;
    seen.add(key);
    out.push(venue);
  }
  return out.slice(0, DRAFTS.manualVenuesMax);
}

/** Once per run: LLM suggests venues on platforms without search APIs. Failures are logged, not fatal. */
export async function suggestManualVenues(
  llm: LLMProvider,
  model: string,
  supabase: ServiceSupabase,
  project: Project,
  ctx: LogContext,
): Promise<{ suggested: number; added: number }> {
  try {
    const existing = await listVenueNames(supabase, project.id);
    const result = await llm.completeJSON(manualVenuesPrompt(project, existing), manualVenuesSchema, {
      model,
      system: MANUAL_VENUES_SYSTEM,
      temperature: DRAFTS.temperature,
    });
    const fresh = selectNewVenues(result.venues, existing);
    const added = await insertManualVenues(supabase, project.id, fresh);
    return { suggested: result.venues.length, added };
  } catch (err) {
    log.warn("manual venues skipped", { ...ctx, model, error: errorMessage(err) });
    return { suggested: 0, added: 0 };
  }
}
