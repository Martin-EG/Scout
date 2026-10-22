import { getEnv } from "@/lib/config";
import { OllamaProvider } from "./ollama";
import type { LLMProvider } from "./types";

export * from "./errors";
export type { CompleteOptions, LLMProvider } from "./types";
export { OllamaProvider } from "./ollama";

export function createLLMProvider(): LLMProvider {
  return new OllamaProvider({ baseUrl: getEnv().OLLAMA_BASE_URL });
}

export function getModels(): { scorer: string; drafter: string } {
  const env = getEnv();
  return { scorer: env.SCORER_MODEL, drafter: env.DRAFTER_MODEL };
}
