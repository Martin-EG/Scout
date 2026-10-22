import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { LLMOutputError, LLMRequestError } from "@/lib/llm/errors";
import { extractJSON } from "@/lib/llm/extractJSON";
import { OllamaProvider } from "@/lib/llm/ollama";

const scoreSchema = z.object({ intent: z.number().min(0).max(1), reason: z.string() });
const opts = { model: "test-model" };

/** Fake fetch returning each reply in turn as an OpenAI-style chat response. */
function fakeFetch(...replies: string[]) {
  const queue = [...replies];
  return vi.fn(async () => {
    const content = queue.shift() ?? "";
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
  });
}

function provider(fetchImpl: ReturnType<typeof fakeFetch>) {
  return new OllamaProvider({ baseUrl: "http://ollama.test/", fetch: fetchImpl as typeof fetch });
}

describe("completeJSON", () => {
  it("parses a plain JSON reply", async () => {
    const fetch = fakeFetch('{"intent": 0.8, "reason": "asks for an app"}');
    await expect(provider(fetch).completeJSON("p", scoreSchema, opts)).resolves.toEqual({
      intent: 0.8,
      reason: "asks for an app",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("extracts JSON embedded in prose", async () => {
    const fetch = fakeFetch(
      'Sure! Here is my answer: {"intent": 0.4, "reason": "mentions {braces} in text"} Hope it helps.',
    );
    await expect(provider(fetch).completeJSON("p", scoreSchema, opts)).resolves.toEqual({
      intent: 0.4,
      reason: "mentions {braces} in text",
    });
  });

  it("extracts JSON from a code fence", async () => {
    const fetch = fakeFetch('Result:\n```json\n{"intent": 1, "reason": "direct ask"}\n```\n');
    await expect(provider(fetch).completeJSON("p", scoreSchema, opts)).resolves.toEqual({
      intent: 1,
      reason: "direct ask",
    });
  });

  it("retries once when the first reply fails the schema", async () => {
    const fetch = fakeFetch('{"intent": "high"}', '{"intent": 0.9, "reason": "ok"}');
    await expect(provider(fetch).completeJSON("p", scoreSchema, opts)).resolves.toEqual({
      intent: 0.9,
      reason: "ok",
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("throws LLMOutputError after the retry when the schema still fails", async () => {
    const fetch = fakeFetch('{"intent": 5, "reason": "x"}', '{"intent": "high"}');
    const error = await provider(fetch)
      .completeJSON("p", scoreSchema, opts)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LLMOutputError);
    expect(error).toMatchObject({ kind: "schema_mismatch", attempts: 2, model: "test-model" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("throws LLMOutputError with kind no_json when there is no JSON at all", async () => {
    const fetch = fakeFetch("I cannot answer that.", "Still no JSON.");
    await expect(provider(fetch).completeJSON("p", scoreSchema, opts)).rejects.toMatchObject({
      name: "LLMOutputError",
      kind: "no_json",
    });
  });

  it("sends JSON mode and the retry note to the OpenAI-compatible endpoint", async () => {
    const fetch = fakeFetch("nope", '{"intent": 0, "reason": "none"}');
    await provider(fetch).completeJSON("score this", scoreSchema, opts);
    const calls = fetch.mock.calls as unknown as [string, RequestInit][];
    expect(calls[0][0]).toBe("http://ollama.test/v1/chat/completions");
    const first = JSON.parse(String(calls[0][1].body));
    const second = JSON.parse(String(calls[1][1].body));
    expect(first.response_format).toEqual({ type: "json_object" });
    expect(first.messages.at(-1).content).toBe("score this");
    expect(second.messages.at(-1).content).toContain("not valid JSON");
  });

  it("wraps HTTP errors in LLMRequestError without retrying", async () => {
    const fetch = vi.fn(async () => new Response("model not found", { status: 404 }));
    const error = await provider(fetch as unknown as ReturnType<typeof fakeFetch>)
      .completeJSON("p", scoreSchema, opts)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LLMRequestError);
    expect(error).toMatchObject({ status: 404 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("extractJSON", () => {
  it("reports invalid JSON separately from missing JSON", () => {
    expect(extractJSON('{"intent": 0.5,}')).toMatchObject({ ok: false, kind: "invalid_json" });
    expect(extractJSON("no braces here")).toMatchObject({ ok: false, kind: "no_json" });
  });

  it("handles escaped quotes inside strings", () => {
    expect(extractJSON('x {"reason": "she said \\"hi\\" }"} y')).toEqual({
      ok: true,
      value: { reason: 'she said "hi" }' },
    });
  });

  it("parses top-level arrays", () => {
    expect(extractJSON("[1, 2]")).toEqual({ ok: true, value: [1, 2] });
  });
});
