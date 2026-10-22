import { z } from "zod";
import { LLM } from "@/lib/config";
import { LLMOutputError, LLMRequestError, type LLMOutputErrorKind } from "./errors";
import { extractJSON } from "./extractJSON";
import type { CompleteOptions, LLMProvider } from "./types";

// Response shape of POST /v1/chat/completions (OpenAI-compatible), validated
// because the server is outside our control.
const chatResponseSchema = z.object({
  choices: z
    .array(z.object({ message: z.object({ content: z.string().nullable() }) }))
    .min(1),
});

const JSON_RETRY_NOTE =
  "\n\nYour previous reply was not valid JSON for the required shape. Reply with only the JSON, no prose, no code fences.";

export interface OllamaProviderOptions {
  baseUrl: string;
  /** Injectable for tests. */
  fetch?: typeof fetch;
}

export class OllamaProvider implements LLMProvider {
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OllamaProviderOptions) {
    this.endpoint = `${options.baseUrl.replace(/\/+$/, "")}/v1/chat/completions`;
    this.fetchImpl = options.fetch ?? fetch;
  }

  complete(prompt: string, opts: CompleteOptions): Promise<string> {
    return this.chat(prompt, opts, false);
  }

  async completeJSON<T>(prompt: string, schema: z.ZodType<T>, opts: CompleteOptions): Promise<T> {
    const maxAttempts = 1 + LLM.jsonRetries;
    let failure: { kind: LLMOutputErrorKind; message: string; raw: string } | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const raw = await this.chat(attempt === 1 ? prompt : prompt + JSON_RETRY_NOTE, opts, true);
      const extracted = extractJSON(raw);
      if (!extracted.ok) {
        failure = { kind: extracted.kind, message: extracted.message, raw };
        continue;
      }
      const validated = schema.safeParse(extracted.value);
      if (validated.success) return validated.data;
      failure = { kind: "schema_mismatch", message: z.prettifyError(validated.error), raw };
    }

    // failure is always set here: every loop iteration either returns or sets it.
    const last = failure!;
    throw new LLMOutputError(
      `Model ${opts.model} returned unusable JSON after ${maxAttempts} attempts: ${last.message}`,
      last.kind,
      opts.model,
      maxAttempts,
      last.raw.slice(0, LLM.rawOutputLogChars),
    );
  }

  private async chat(prompt: string, opts: CompleteOptions, json: boolean): Promise<string> {
    const messages = [
      ...(opts.system ? [{ role: "system", content: opts.system }] : []),
      { role: "user", content: prompt },
    ];

    let response: Response;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: opts.model,
          messages,
          temperature: opts.temperature ?? LLM.defaultTemperature,
          ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
          ...(json ? { response_format: { type: "json_object" } } : {}),
          stream: false,
        }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? LLM.requestTimeoutMs),
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new LLMRequestError(`Ollama request failed (${this.endpoint}): ${reason}`, opts.model);
    }

    if (!response.ok) {
      const body = (await response.text().catch(() => "")).slice(0, LLM.rawOutputLogChars);
      throw new LLMRequestError(
        `Ollama returned HTTP ${response.status} for model ${opts.model}: ${body}`,
        opts.model,
        response.status,
      );
    }

    const parsed = chatResponseSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) {
      throw new LLMRequestError(`Unexpected Ollama response shape for model ${opts.model}`, opts.model);
    }
    return parsed.data.choices[0].message.content ?? "";
  }
}
