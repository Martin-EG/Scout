// Preflight before a run: Ollama (with the needed models) and SearXNG must be up.
// Messages are written for the runs table, so they say what to do.
import { z } from "zod";

const HEALTH_TIMEOUT_MS = 5_000;

const tagsSchema = z.object({ models: z.array(z.object({ name: z.string() })) });

export interface HealthInput {
  ollamaUrl: string;
  searxngUrl: string;
  models: string[];
  fetch?: typeof fetch;
}

async function get(fetchImpl: typeof fetch, url: string): Promise<Response | null> {
  try {
    return await fetchImpl(url, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
  } catch {
    return null;
  }
}

/** Problems found, as user-facing sentences. Empty when everything is ready. */
export async function checkServices(input: HealthInput): Promise<string[]> {
  const fetchImpl = input.fetch ?? fetch;
  const ollama = input.ollamaUrl.replace(/\/+$/, "");
  const searxng = input.searxngUrl.replace(/\/+$/, "");
  const problems: string[] = [];

  const [tags, searx] = await Promise.all([get(fetchImpl, `${ollama}/api/tags`), get(fetchImpl, `${searxng}/healthz`)]);

  if (!tags?.ok) {
    problems.push(`Ollama is not reachable at ${ollama}. Start Ollama, then press Run now again.`);
  } else {
    const parsed = tagsSchema.safeParse(await tags.json().catch(() => null));
    const installed = new Set(parsed.success ? parsed.data.models.map((m) => m.name) : []);
    for (const model of new Set(input.models)) {
      if (!installed.has(model)) problems.push(`Model ${model} is not installed. Run: ollama pull ${model}`);
    }
  }
  if (!searx?.ok) {
    problems.push(`SearXNG is not reachable at ${searxng}. Start it with: docker compose up -d`);
  }
  return problems;
}
