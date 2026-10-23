import { DRAFTS, SCOUT } from "@/lib/config";
import {
  insertDraftWithCode,
  markLeadDrafted,
  type LeadToDraft,
  type ServiceSupabase,
} from "@/lib/db/scoutStore";
import type { LLMProvider } from "@/lib/llm";
import { DRAFT_SYSTEM, draftPrompt } from "@/lib/llm/prompts/draft";
import { draftSchema } from "@/lib/llm/schemas/draft";
import type { Hit, HitSource, Project } from "@/types/domain";
import { generateShortCode, shortLink } from "@/lib/utm";
import { normalizeText } from "./keywords";
import { errorMessage, log, type LogContext } from "./log";
import { estimateRedditDates } from "./redditAge";
import { codeSequence, SHORT_CODE_ATTEMPTS, trackedDraftFields } from "./trackedLink";
import { isTooOld } from "./rules";

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** True when the text says plainly that the developer built the app. */
export function hasDisclosure(text: string): boolean {
  const normalized = ` ${normalizeText(text)} `;
  return DRAFTS.disclosureMarkers.some((marker) => normalized.includes(` ${marker} `));
}

/** Product rules a draft must meet. Returns the problems found (empty when the draft is fine). */
export function draftProblems(body: string, maxWords: number = DRAFTS.maxWords): string[] {
  const problems: string[] = [];
  if (wordCount(body) > maxWords) problems.push(`over ${maxWords} words`);
  if (!hasDisclosure(body)) problems.push('missing the disclosure ("I built ...")');
  return problems;
}

/**
 * Leads still fresh enough to reply to: drops ones whose date (stored, or
 * estimated from the Reddit post id) is past the age limit, then caps the list.
 * Leads stored before the Reddit date estimate existed can be years old.
 */
export function selectLeadsToDraft(
  leads: LeadToDraft[],
  now: number,
  max: number = DRAFTS.maxPerRun,
  maxAgeDays: number = SCOUT.maxHitAgeDays,
): LeadToDraft[] {
  const asHits: Hit[] = leads.map((lead) => ({
    source: lead.source as HitSource,
    url: lead.url,
    title: lead.title,
    snippet: "",
    venueName: "",
    venueUrl: "",
    ...(lead.posted_at ? { postedAt: lead.posted_at } : {}),
  }));
  const dated = estimateRedditDates(asHits);
  return leads.filter((_, i) => !isTooOld(dated[i], now, maxAgeDays)).slice(0, max);
}

/** Draft schema plus the product rules, so completeJSON retries a draft that breaks them. */
export const checkedDraftSchema = draftSchema.superRefine((draft, ctx) => {
  for (const problem of draftProblems(draft.body)) ctx.addIssue({ code: "custom", message: problem, path: ["body"] });
});

/**
 * DRAFTER_MODEL writes one reply per lead. A lead whose draft fails (bad JSON
 * or broken rules after the retry) is logged and skipped; it stays "new" and
 * is retried on the next run.
 */
export async function draftLeads(
  llm: LLMProvider,
  model: string,
  supabase: ServiceSupabase,
  project: Project,
  leads: LeadToDraft[],
  appUrl: string,
  ctx: LogContext,
): Promise<{ drafted: number; failed: number }> {
  let drafted = 0;
  let failed = 0;
  for (const lead of leads) {
    try {
      // The prompt shows the first code's link; the insert uses that code unless it collides.
      const firstCode = generateShortCode();
      const promptLink = shortLink(appUrl, firstCode);
      const draft = await llm.completeJSON(
        draftPrompt({ project, lead, venue: lead.venue, link: promptLink }),
        checkedDraftSchema,
        { model, system: DRAFT_SYSTEM, temperature: DRAFTS.temperature },
      );
      const linkOpts = {
        appUrl,
        projectUrl: project.url,
        platform: lead.venue?.platform ?? "web",
        venueName: lead.venue?.name ?? "web",
        promptLink,
      };
      await insertDraftWithCode(
        supabase,
        (code) => ({
          project_id: project.id,
          lead_id: lead.id,
          venue_id: lead.venue?.id ?? null,
          language: draft.language,
          ...trackedDraftFields(draft.body, code, linkOpts),
        }),
        codeSequence(firstCode),
        SHORT_CODE_ATTEMPTS,
      );
      await markLeadDrafted(supabase, lead.id);
      drafted++;
    } catch (err) {
      failed++;
      log.warn("draft skipped", { ...ctx, leadId: lead.id, model, error: errorMessage(err) });
    }
  }
  return { drafted, failed };
}
