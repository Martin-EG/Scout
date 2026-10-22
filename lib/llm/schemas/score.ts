import { z } from "zod";

const score = z.coerce.number().min(0).max(10);

export const hitScoreSchema = z.object({
  url: z.string().trim().min(1),
  relevance: score,
  intent: score,
  reason: z.string().trim().default(""),
});

export const scoreBatchSchema = z.object({
  results: z.array(hitScoreSchema),
});

export type HitScore = z.infer<typeof hitScoreSchema>;
