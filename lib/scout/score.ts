import { SCOUT } from "@/lib/config";
import type { LLMProvider } from "@/lib/llm";
import { SCORE_SYSTEM, scorePrompt } from "@/lib/llm/prompts/score";
import { scoreBatchSchema, type HitScore } from "@/lib/llm/schemas/score";
import type { Hit, Project } from "@/types/domain";
import { normalizeUrl } from "./dedupe";
import { errorMessage, log, type LogContext } from "./log";
import type { ScoredHit } from "./rules";

export interface ScoreStats {
  batches: number;
  failedBatches: number;
  /** Hits the model returned no score for (wrong or missing url). */
  unmatched: number;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Pairs model scores with the batch's hits by normalized url. Unknown urls are ignored. */
export function matchScores(batch: Hit[], scores: HitScore[]): ScoredHit[] {
  const byUrl = new Map(scores.map((s) => [normalizeUrl(s.url), s]));
  const out: ScoredHit[] = [];
  for (const hit of batch) {
    const score = byUrl.get(normalizeUrl(hit.url));
    if (!score) continue;
    out.push({
      ...hit,
      relevance: score.relevance,
      intent: score.intent,
      reason: score.reason.slice(0, SCOUT.reasonChars),
    });
  }
  return out;
}

/**
 * SCORER_MODEL scores hits in small batches. A batch the model can't answer
 * with valid JSON (after completeJSON's retry) is logged and skipped.
 */
export async function scoreHits(
  llm: LLMProvider,
  model: string,
  project: Project,
  hits: Hit[],
  ctx: LogContext,
): Promise<{ scored: ScoredHit[]; stats: ScoreStats }> {
  const batches = chunk(hits, SCOUT.scoreBatchSize);
  const stats: ScoreStats = { batches: batches.length, failedBatches: 0, unmatched: 0 };
  const scored: ScoredHit[] = [];

  for (const [index, batch] of batches.entries()) {
    try {
      const result = await llm.completeJSON(
        scorePrompt(project, batch, { snippetChars: SCOUT.scoreSnippetChars }),
        scoreBatchSchema,
        { model, system: SCORE_SYSTEM, temperature: SCOUT.scorerTemperature },
      );
      const matched = matchScores(batch, result.results);
      stats.unmatched += batch.length - matched.length;
      scored.push(...matched);
    } catch (err) {
      stats.failedBatches++;
      log.warn("score batch skipped", { ...ctx, batch: index, model, error: errorMessage(err) });
    }
  }
  return { scored, stats };
}
