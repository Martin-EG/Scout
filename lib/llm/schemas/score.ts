import { z } from "zod";

const score = z.coerce.number().min(0).max(10);

/** Who wrote the page. Unknown spellings count as "publisher" so they are never kept by accident. */
const authorType = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
  z.enum(["person", "publisher"]).catch("publisher"),
);

/** "true"/"yes" strings count as true; anything unreadable as false (the title rule backs it up). */
const flag = z.preprocess(
  (value) => (typeof value === "string" ? /^(true|yes)$/i.test(value.trim()) : value),
  z.boolean().catch(false),
);

export const hitScoreSchema = z.object({
  url: z.string().trim().min(1),
  author_type: authorType,
  self_promo: flag.default(false),
  relevance: score,
  intent: score,
  reason: z.string().trim().default(""),
});

export const scoreBatchSchema = z.object({
  results: z.array(hitScoreSchema),
});

export type HitScore = z.infer<typeof hitScoreSchema>;
