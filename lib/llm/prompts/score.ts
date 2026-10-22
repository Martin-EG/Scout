import type { Hit, Project } from "@/types/domain";
import { formatProjectProfile } from "./profile";

export const SCORE_SYSTEM =
  "You judge whether online posts are good places for an indie developer to helpfully mention their app. You are strict and honest. You reply with JSON only.";

interface ScorePromptOptions {
  snippetChars: number;
}

function formatHit(hit: Hit, index: number, snippetChars: number): string {
  const posted = hit.postedAt ? hit.postedAt.slice(0, 10) : "unknown";
  const text = hit.snippet.replace(/\s+/g, " ").trim().slice(0, snippetChars);
  return `[${index + 1}] url: ${hit.url}
where: ${hit.venueName} | posted: ${posted}
title: ${hit.title}
text: ${text || "(none)"}`;
}

export function scorePrompt(project: Project, hits: Hit[], opts: ScorePromptOptions): string {
  return `App profile:
${formatProjectProfile(project)}

Score each post below.

author_type: "person" if an individual wrote it about their own life (a question, a complaint, a story, a forum reply); "publisher" if a company, brand, store, app, blog, magazine, or media outlet wrote it.
relevance (0-10): how closely the post is about the problems this app solves, for its audience.
intent (0-10): how likely the author would welcome a recommendation for a tool like this right now.
  10 = explicitly asks for an app, tool, or recommendation for this exact problem
  7  = describes the problem or frustration in their own words
  4  = discusses the topic in general
  0  = news, ads, store listings, product pages, a competitor's own marketing, or unrelated
Judge the person writing, not the topic: a store listing, product page, review site, or "top 10 apps" article is not a person with a need, so its intent is 0 even when the topic matches.
reason: one short sentence that cites what the post says.

Posts:
${hits.map((hit, i) => formatHit(hit, i, opts.snippetChars)).join("\n\n")}

Reply with only this JSON shape, one entry per post, copying each url exactly:
{"results": [{"url": "...", "author_type": "person", "relevance": 0, "intent": 0, "reason": "..."}]}`;
}
