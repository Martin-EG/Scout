"use server";

// Dev-only exception to the layer rules: app/ calls lib/llm directly so the
// model can be smoke-tested from the browser. Disabled in production.
import { z } from "zod";
import { requireUser } from "@/lib/db/auth";
import { createLLMProvider, getModels } from "@/lib/llm";
import type { LLMTestState } from "@/components/dev/LLMPlayground";

const PROMPT_MAX = 8000;
const promptSchema = z.string().trim().min(1, "Enter a prompt.").max(PROMPT_MAX);

export async function runPrompt(_prev: LLMTestState, formData: FormData): Promise<LLMTestState> {
  if (process.env.NODE_ENV === "production") return { error: "Disabled in production." };
  await requireUser();

  const prompt = promptSchema.safeParse(formData.get("prompt"));
  if (!prompt.success) return { error: prompt.error.issues[0]?.message };

  const model = getModels().scorer;
  const started = performance.now();
  try {
    const reply = await createLLMProvider().complete(prompt.data, { model });
    return { reply, model, latencyMs: Math.round(performance.now() - started), prompt: prompt.data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[dev/llm] completion failed", { model, message });
    return { error: message, model, latencyMs: Math.round(performance.now() - started), prompt: prompt.data };
  }
}
