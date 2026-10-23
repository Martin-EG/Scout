import { describe, expect, it, vi } from "vitest";
import { checkServices } from "@/lib/scout/health";

const base = { ollamaUrl: "http://ollama.test/", searxngUrl: "http://searx.test", models: ["gemma3:12b", "gemma3:12b"] };

function fakeFetch(routes: Record<string, Response | Error>) {
  return vi.fn(async (url: string) => {
    const hit = routes[url];
    if (!hit) throw new Error(`unexpected ${url}`);
    if (hit instanceof Error) throw hit;
    return hit.clone();
  }) as unknown as typeof fetch;
}

const tags = (...names: string[]) => Response.json({ models: names.map((name) => ({ name })) });

describe("checkServices", () => {
  it("passes when Ollama has the models and SearXNG is up", async () => {
    const fetch = fakeFetch({
      "http://ollama.test/api/tags": tags("gemma3:12b", "gemma3:4b"),
      "http://searx.test/healthz": new Response("OK"),
    });
    expect(await checkServices({ ...base, fetch })).toEqual([]);
  });

  it("explains a missing model once and how to pull it", async () => {
    const fetch = fakeFetch({
      "http://ollama.test/api/tags": tags("gemma3:4b"),
      "http://searx.test/healthz": new Response("OK"),
    });
    expect(await checkServices({ ...base, fetch })).toEqual([
      "Model gemma3:12b is not installed. Run: ollama pull gemma3:12b",
    ]);
  });

  it("explains Ollama and SearXNG being down", async () => {
    const fetch = fakeFetch({
      "http://ollama.test/api/tags": new Error("ECONNREFUSED"),
      "http://searx.test/healthz": new Response("", { status: 502 }),
    });
    const problems = await checkServices({ ...base, fetch });
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(/Ollama is not reachable at http:\/\/ollama.test\. Start Ollama/);
    expect(problems[1]).toMatch(/SearXNG is not reachable .* docker compose up -d/);
  });
});
