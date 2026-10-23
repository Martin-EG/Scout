import { DRAFTS } from "@/lib/config";
import type { Project } from "@/types/domain";
import { formatProjectProfile } from "./profile";

export const MANUAL_VENUES_SYSTEM =
  "You help an indie developer find communities on platforms without search APIs. You suggest real, plausible places and honest outreach. You reply with JSON only.";

export function manualVenuesPrompt(project: Project, existingNames: string[]): string {
  const avoid = existingNames.length > 0 ? `\nAlready known (do not repeat): ${existingNames.join(", ")}\n` : "";
  return `App profile:
${formatProjectProfile(project)}
${avoid}
Suggest up to ${DRAFTS.manualVenuesMax} places where this app's audience gathers on platforms that can't be searched automatically: TikTok or Instagram hashtags, creator niches on YouTube, kinds of Facebook groups to look for, newsletters.

For each: 
- platform: one of tiktok, instagram, facebook, youtube, newsletter, pinterest, discord, other
- name: the hashtag, group type, or creator niche (e.g. "#projectpan", "Makeup declutter Facebook groups")
- why: one sentence on why this audience fits
- draft: a short caption or outreach message the developer could post or send (under ${DRAFTS.maxWords} words, says plainly the developer built the app, no hype, no fake testimonials)
- language: "en" or "es"

Include at least two Spanish-language places if the profile has Spanish keywords.

Reply with only this JSON shape:
{"venues": [{"platform": "tiktok", "name": "...", "why": "...", "draft": "...", "language": "en"}]}`;
}
