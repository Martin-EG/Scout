import { z } from "zod";

const score = z.coerce.number().min(0).max(10);

/** Who wrote the page. Unknown spellings count as "publisher" so they are never kept by accident. */
const authorType = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
  z.enum(["person", "publisher"]).catch("publisher"),
);

export const hitScoreSchema = z.object({
  url: z.string().trim().min(1),
  author_type: authorType,
  relevance: score,
  intent: score,
  reason: z.string().trim().default(""),
});

export const scoreBatchSchema = z.object({
  results: z.array(hitScoreSchema),
});

export type HitScore = z.infer<typeof hitScoreSchema>;
