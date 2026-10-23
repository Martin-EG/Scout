import { DRAFTS } from "@/lib/config";
import type { Lead, Project, Venue } from "@/types/domain";
import { formatProjectProfile } from "./profile";

export const DRAFT_SYSTEM =
  "You write short, honest forum replies for an indie developer. You help the person first. You never invent experiences, testimonials, or numbers. You reply with JSON only.";

/** True only when the venue's link_policy explicitly allows links. Unknown means no link. */
export function linkPolicyAllowsLinks(linkPolicy: string | null | undefined): boolean {
  if (!linkPolicy) return false;
  const policy = linkPolicy.trim().toLowerCase();
  return DRAFTS.linkAllowedPolicies.some((allowed) => policy === allowed);
}

export interface DraftPromptInput {
  project: Project;
  lead: Pick<Lead, "title" | "snippet" | "url">;
  venue: Pick<Venue, "name" | "rules" | "link_policy"> | null;
  /** Tracking link (/r/<code>) to use instead of the bare project URL. */
  link: string;
}

export function draftPrompt({ project, lead, venue, link }: DraftPromptInput): string {
  const linkRule = linkPolicyAllowsLinks(venue?.link_policy)
    ? `You may include the link ${link} once, at the end.`
    : 'Do not include any link. If it fits, say "happy to share the link" instead.';
  return `App profile:
${formatProjectProfile(project)}

Thread on ${venue?.name ?? "the web"}:
title: ${lead.title}
text: ${(lead.snippet ?? "").replace(/\s+/g, " ").trim() || "(no text)"}
${venue?.rules ? `Venue rules: ${venue.rules}\n` : ""}
Write a reply to this thread.

Rules:
- Write in the same language as the thread.
- First answer the person's actual question or problem with useful, specific advice.
- Then mention ${project.name} in at most two sentences, with a plain disclosure that you built it (for example "I built ${project.name}" or in Spanish "lo creé yo").
- ${linkRule}
- No fake testimonials, no hype words (amazing, game-changer, revolutionary), no emojis.
- Under ${DRAFTS.maxWords} words.
- Tone: ${project.tone || "friendly and honest"}.

Reply with only this JSON shape:
{"body": "...", "language": "en"}`;
}
