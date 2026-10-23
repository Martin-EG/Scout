# Scout

Web app where indie devs add their apps; an open-weight LLM agent finds where potential
users hang out, surfaces threads with buying intent, and drafts replies. The user approves,
copies, and posts. Scout NEVER posts anything itself. First test project: GlamVault
(personal beauty collection manager, https://try-glamvault.vercel.app/).

## Stack
- Next.js (App Router), TypeScript strict, Tailwind, pnpm
- Supabase: Postgres, email auth, row-level security, migrations in supabase/migrations
- Worker: Node + TypeScript (tsx), polls the runs table
- LLM: Ollama, Gemma models (latest Gemma tags in the Ollama library; gemma3:12b for
  planning, scoring, and drafts since day 3: 4b scored off-topic posts too high), via its
  OpenAI-compatible API behind an LLMProvider interface. Gemma is required: we enter the Best Use of Gemma category.
- Search: SearXNG (docker-compose), Reddit search, Hacker News (Algolia) search,
  SerpApi (Google results; Best Use of SerpApi category)
- Validation: Zod for env, API input, and every LLM output

## Repo structure

scout/
  app/                    Next.js routes only (thin): (auth)/, projects/, projects/[id]/inbox/,
                          projects/[id]/runs/, r/[code]/ (UTM redirect), api/
  components/             UI components; ui/ for primitives, feature folders for the rest
  lib/
    db/                   Supabase clients (browser, server, service) + typed queries
    llm/                  LLMProvider interface, OllamaProvider, prompts/, schemas/
    sources/              one adapter per source: reddit.ts, hackernews.ts, searxng.ts, serpapi.ts,
                          all returning the same Hit type
    scout/                pipeline steps: planQueries, search, dedupe, score, draft, manualVenues
    utm.ts, config.ts     helpers and constants (thresholds, quotas, model names)
  worker/                 index.ts (poll loop), runScout.ts (calls lib/scout in order)
  supabase/migrations/    SQL schema + RLS policies
  types/                  shared domain types (Project, Venue, Lead, Draft, Run, Hit)
  tests/                  mirrors lib/ (unit tests for parsers, dedupe, scoring rules)
  docker-compose.yml      SearXNG

## Layer rules
- app/ and components/ -> lib/db, types. They never call the LLM or sources directly.
- worker/ -> lib/scout -> lib/llm, lib/sources, lib/db.
- lib/llm and lib/sources know nothing about the database or UI.
- Server-only code (service role key, worker) never imported into client components.

## Code conventions
- Small files, one responsibility; functions over classes except providers/adapters.
- No magic numbers: thresholds, quotas, model names in lib/config.ts.
- LLM output is untrusted: parse with Zod, retry once, then skip the item (never crash a run).
- Errors logged with context (project id, run id, source); runs record their error.
- No `any`. No secrets in client code or git.

## Product rules
- Never auto-post. No platform write APIs, ever.
- Every draft includes a short disclosure line ("I built this") and answers the person first.
- Venue cooldown: warn if posted in the same venue in the last 7 days.
- Per-user quota: 3 runs per day (config).

## End of every task (required)
1. Update README.md (create it on day 1: Overview, How it works, Architecture, Setup,
   Dev log). Keep "How it works" true to what works today; add every new setup step;
   add a dated Dev log entry (what was built, files changed, known issues).
2. Reply in chat with:
   - What we did: 3-6 bullets
   - How it works: the flow you built, naming key files and how they connect
   - Decisions and trade-offs
   - Manual steps for me
   - Known issues / next up

## Git
- main always runs. One commit per day minimum: "dayN: <summary>".
- Never commit .env files, keys, or model files.
