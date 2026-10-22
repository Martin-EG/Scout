import { z } from "zod";

const SOURCE_ALIASES: Record<string, string> = {
  hackernews: "hn",
  "hacker news": "hn",
  google: "web",
  searxng: "web",
};

/** Normalizes common model spellings ("Hacker News", "Reddit") before the enum check. */
const querySource = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const key = value.trim().toLowerCase();
  return SOURCE_ALIASES[key] ?? key;
}, z.enum(["reddit", "hn", "web"]));

/** "EN", "es-MX", "spanish" -> two-letter code. */
const lang = z
  .string()
  .trim()
  .min(2)
  .transform((value) => {
    const lower = value.toLowerCase();
    if (lower.startsWith("span") || lower.startsWith("esp")) return "es";
    if (lower.startsWith("eng")) return "en";
    return lower.slice(0, 2);
  });

export const plannedQuerySchema = z.object({
  text: z.string().trim().min(2).max(200),
  lang,
  source: querySource,
  why: z.string().trim().default(""),
});

export const queryPlanSchema = z.object({
  queries: z.array(plannedQuerySchema).min(1),
});

export type PlannedQuery = z.infer<typeof plannedQuerySchema>;
export type QuerySource = PlannedQuery["source"];
