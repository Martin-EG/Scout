import type { z } from "zod";

export interface CompleteOptions {
  /** Model tag, e.g. the scorer or drafter model from config. */
  model: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface LLMProvider {
  /** Plain text completion. */
  complete(prompt: string, opts: CompleteOptions): Promise<string>;
  /**
   * Completion parsed as JSON and validated with `schema`. Retries once on
   * unparseable or invalid output, then throws LLMOutputError.
   */
  completeJSON<T>(prompt: string, schema: z.ZodType<T>, opts: CompleteOptions): Promise<T>;
}
