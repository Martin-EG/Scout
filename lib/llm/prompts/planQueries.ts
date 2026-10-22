import type { Project } from "@/types/domain";
import { formatProjectProfile } from "./profile";

export const PLAN_QUERIES_SYSTEM =
  "You help an indie developer find online conversations where real people describe the problems their app solves. You reply with JSON only.";

interface PlanPromptOptions {
  minQueries: number;
  maxQueries: number;
}

export function planQueriesPrompt(project: Project, opts: PlanPromptOptions): string {
  const spanish = project.keywords_es.length > 0;
  return `App profile:
${formatProjectProfile(project)}

Write between ${opts.minQueries} and ${opts.maxQueries} search queries that find recent posts by people who would want this app.

Rules:
- Write the way people actually post, not marketing copy. Describe the problem in their own words ("I keep buying the same lipstick shade", "forgot I already had this"), ask for help ("app to track my makeup collection"), or look for options ("alternative to <a competitor or a spreadsheet>").
- Keep each query short: 2 to 7 words. No quotes, no boolean operators, no site: filters.
- Languages: ${spanish ? 'English and Spanish. At least a third of the queries in natural Spanish (lang "es"), the rest in English (lang "en").' : 'English (lang "en").'}
- source tells where the query runs:
  "reddit" = Reddit search over posts (about 40% of queries),
  "web" = Google and web search for forums, blogs, and Q&A sites (about 45%),
  "hn" = Hacker News, only if developers or tech people are part of the audience (0 to 2 queries).
- why: one short sentence on what kind of post the query should find.

Reply with only this JSON shape:
{"queries": [{"text": "...", "lang": "en", "source": "reddit", "why": "..."}]}`;
}
