# Scout

## Overview

Scout helps indie devs find people who need their app. You add an app; an open-weight
LLM agent (Gemma via Ollama) finds where potential users hang out, surfaces threads with
buying intent, and drafts honest replies. You approve, copy, and post yourself.
**Scout never posts anything.**

First test project: [GlamVault](https://try-glamvault.vercel.app/), a personal beauty
collection manager.

## How it works

What works today:

1. **Sign in** with email + password (Supabase Auth). Every route except `/sign-in` and
   the email-confirmation callback redirects to sign-in when signed out (`proxy.ts`).
2. **Projects**: list, create, edit, delete your apps at `/projects`. Each project stores
   name, URL, description, audience, problems, English/Spanish keywords, tone, and region.
   Row-level security means you only ever see your own projects and their data.
3. **LLM provider**: `lib/llm` talks to Ollama's OpenAI-compatible API. `completeJSON`
   pulls JSON out of the reply (plain, in prose, or in a code fence), validates it with
   Zod, retries once, then throws a typed `LLMOutputError`.
4. **Dev LLM page** at `/dev/llm` (dev only): send a prompt to `SCORER_MODEL`, see the
   reply and latency.
5. **Run now** (projects page) inserts a `queued` run. Limit: 3 runs per user per UTC day,
   one active run per project. The runs table under each project polls every 5 s while a
   run is queued or running, showing hits, leads kept, and plan / search / score times.
6. **Worker** (`pnpm worker`) polls `runs` every 5 s, claims one queued run at a time, and
   runs the pipeline:
   - **plan**: `DRAFTER_MODEL` (gemma3:12b) turns the project profile into 10-20 queries,
     English and Spanish, each tagged `reddit`, `hn`, or `web` (falls back to the project's
     keywords if the model fails).
   - **search**: Reddit, Hacker News (Algolia), SearXNG, and SerpApi (Google, past month).
     Each source has a timeout, a User-Agent, and its own rate limit. If Reddit answers
     403/429, the remaining Reddit queries run on SerpApi as `site:reddit.com`. SerpApi is
     skipped when `SERPAPI_KEY` is unset.
   - **dedupe**: URLs normalized (tracking params, fragments, trailing slashes, reddit
     hosts) and dropped if already a lead for the project (dismissed ones included).
     App-store listings and the project's own site are dropped; hits older than 30 days too.
   - **score**: `SCORER_MODEL` (gemma3:4b) scores batches of 5 hits for relevance and
     intent (0-10) with a reason. Kept if relevance ≥ 6 and intent ≥ 5. Venues are upserted
     (subreddit, Hacker News, or domain) and leads inserted.
   - The run row gets `queries` (each with where it ran, hit count, errors), `hits_found`,
     `leads_kept`, `step_durations`, and `done` or `failed` with the error.
7. **Leads** (`/projects/[id]/leads`, temporary): open leads sorted by intent then
   relevance, with source, venue, scores, reason, link, and a Dismiss button.

Not built yet: drafts, the inbox, manual venues, venue cooldown warnings, UTM redirects.

## Architecture

```
app/          Next.js routes (thin). (auth)/sign-in, auth/confirm, projects/, dev/llm
components/   ui/ primitives (Button, Field, TagInput); auth/, projects/, dev/ features
lib/
  config.ts   env (Zod-validated) + all constants (models, quotas, limits)
  db/         Supabase clients: server (cookies), browser, service (service role);
              auth.ts (getSessionUser/requireUser), session.ts (proxy refresh),
              projects.ts (queries), projectInput.ts (form schema),
  llm/        LLMProvider interface, OllamaProvider, extractJSON, typed errors
              runs.ts, leads.ts (user queries, RLS); runQueue.ts, scoutStore.ts
              (worker, service role)
  llm/        LLMProvider interface, OllamaProvider, extractJSON, typed errors;
              prompts/ (profile, planQueries, score), schemas/ (queryPlan, score)
  sources/    reddit, hackernews, searxng, serpapi adapters -> Hit; http (UA, timeout,
              403/429 -> SourceBlockedError), rateLimit, venue, dates, text
  scout/      planQueries, search (lanes + reddit fallback), dedupe, rules (age,
              thresholds, skip domains), score, keepLeads, log
worker/       index.ts (poll loop, claim, finish/fail), runScout.ts (timed steps)
searxng/      settings.yml for the SearXNG container (JSON format enabled)
supabase/
  migrations/ schema + RLS
  seed.ts     inserts the GlamVault project for a user
types/        domain.ts (Project, Venue, Lead, Draft, Run, Click, Hit), database.ts
tests/        vitest, mirrors lib/; fixtures/sources/*.json (saved API responses)
docker-compose.yml  SearXNG on 127.0.0.1:8080
```

Layer rules: `app/` and `components/` use `lib/db` and `types` only; the worker drives
`lib/scout`, which uses `lib/llm`, `lib/sources`, `lib/db`. The one exception is the
dev-only `/dev/llm` server action, which calls `lib/llm` directly.

Data model (all child tables cascade from `projects`): `projects`, `venues`, `leads`
(unique on `project_id, url`), `drafts`, `runs`, `clicks`. RLS: `projects.user_id =
auth.uid()`; child tables check `owns_project(project_id)`. `clicks` is read-only for
users (written by the service role).

## Setup

Requirements: Node 24+, pnpm 11+, [Ollama](https://ollama.com), a Supabase project.

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Pull the Gemma models:
   ```bash
   ollama pull gemma3:4b && ollama pull gemma3:12b
   ```
3. Copy `.env.example` to `.env.local` and fill it in. `SUPABASE_URL` and
   `SUPABASE_ANON_KEY` come from Supabase → Project Settings → API (the legacy
   `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` names also work).
   `SUPABASE_SERVICE_ROLE_KEY` is needed for `pnpm seed`.
4. Apply the migrations in order: paste each file in `supabase/migrations/` into the
   Supabase SQL editor and run it (or `pnpm dlx supabase db push` with a linked project):
   `20261021000000_init.sql`, then `20261022000000_runs_durations_venue_key.sql`.
5. In Supabase → Authentication → URL Configuration, set Site URL to
   `http://localhost:3000` and add `http://localhost:3000/auth/confirm` to Redirect URLs.
6. Run the app and create your account at `/sign-in` (confirm via the email link):
   ```bash
   pnpm dev
   ```
7. Seed GlamVault for your account:
   ```bash
   pnpm seed you@example.com
   ```
8. Start SearXNG (Docker Desktop must be running). It listens on `http://localhost:8080`,
   which is the default `SEARXNG_URL`:
   ```bash
   docker compose up -d
   ```
   Check the JSON API: `curl 'http://localhost:8080/search?q=test&format=json'`.
   For anything beyond local dev, set `SEARXNG_SECRET` in your shell first.
9. Optional: set `SERPAPI_KEY` in `.env.local` (Google results, and the Reddit fallback
   when Reddit blocks unauthenticated search). Without it SerpApi is skipped.
10. Start the worker in a second terminal (needs Ollama, SearXNG, and the service role key):
    ```bash
    pnpm worker
    ```
    Then press **Run now** on a project. Ctrl+C finishes the current run and exits.

Checks:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

## Dev log

### 2026-10-21 — Day 1: scaffold, auth, schema, projects, LLM provider

Built:
- Next.js 16.4 (App Router, Cache Components, Turbopack), TypeScript strict, Tailwind 4,
  pnpm. Zod-validated env in `lib/config.ts`, `.env.example`.
- Migration `supabase/migrations/20261021000000_init.sql`: six tables, cascading FKs,
  unique `leads(project_id, url)`, RLS via `owns_project()`. Verified in PGlite (owner
  isolation, blocked cross-project insert, unique index, cascade).
- Email + password auth with `@supabase/ssr`: `proxy.ts` refreshes the session and gates
  routes; `/auth/confirm` handles the email link (PKCE code or token hash).
- Projects CRUD: `app/projects/*`, `components/projects/*`, tag inputs for keywords,
  Zod-validated server actions, delete with confirm.
- `lib/llm`: `LLMProvider`, `OllamaProvider` (`/v1/chat/completions`, JSON mode),
  `extractJSON`, `LLMRequestError` / `LLMOutputError`. 11 unit tests.
- `/dev/llm` playground. Live check: `gemma3:4b` returned valid JSON in ~5 s.
- `pnpm seed` (`supabase/seed.ts`): upserts GlamVault for a user by email.

Known issues:
- Projects CRUD and seed not yet exercised against the live database (needs the migration
  applied and an account).
- `Database` type is hand-written (no Supabase CLI here); regenerate with
  `supabase gen types` once the CLI is installed.
- Optional FKs (`leads.run_id`, `leads.venue_id`, `drafts.lead_id`, …) cascade as specified;
  deleting a run deletes its leads.
- No SearXNG docker-compose yet.

### 2026-10-21 — Day 2: search sources, scout pipeline, worker, scored leads

Built:
- `docker-compose.yml` + `searxng/settings.yml`: SearXNG on 127.0.0.1:8080 with JSON output.
- `Hit` type (`types/domain.ts`): source, url, title, snippet, author?, postedAt?, venueName,
  venueUrl. `Run.step_durations`.
- `lib/sources`: `reddit.ts` (search.json, new, last month), `hackernews.ts` (Algolia,
  stories + comments, last 30 days), `searxng.ts`, `serpapi.ts` (Google, past month), all
  with timeout, User-Agent, per-source rate limit (`SOURCES` in `lib/config.ts`), and Zod
  on the response.
- `lib/scout`: `planQueries` (Gemma 12b, Zod plan, keyword fallback), `search` (parallel
  lanes, Reddit -> SerpApi `site:reddit.com` fallback, SerpApi budget per run), `dedupe`
  (URL normalization), `rules` (age, relevance, intent, skip domains), `score` (Gemma 4b,
  batches of 5, failed batch skipped), `keepLeads` (venue upsert + lead insert).
- `worker/index.ts` + `worker/runScout.ts`: poll every 5 s, atomic claim, one run at a
  time, per-step durations, stale `running` runs failed on restart. `pnpm worker`.
- Migration `20261022000000_runs_durations_venue_key.sql`: `runs.step_durations jsonb`,
  unique `venues(project_id, platform, name)`.
- UI: Run now + live runs table (`components/runs/*`), quota and one-active-run checks
  (`lib/db/runs.ts`), temporary leads page with Dismiss (`app/projects/[id]/leads`).
- Tests: 47 passing. URL normalization + dedupe, score rules, skip domains, query plan
  schema, rate limiter, and each adapter's mapping from fixture JSON in
  `tests/fixtures/sources/` (HN, SearXNG, SerpApi captured live and trimmed; Reddit
  hand-built in the documented Listing shape because Reddit returned 403 here).

Measured:
- Planner (gemma3:12b): 19 queries, 12 EN / 7 ES, 78 s. Scorer (gemma3:4b): batch of 4 in
  18 s (includes model load).

Known issues:
- No full live run yet: the day-2 migration was not applied to the Supabase project when
  this was written. One GlamVault run is queued and will start when the worker runs.
- Reddit's public JSON returns 403 from this network for any User-Agent, so Reddit
  queries go through SerpApi (`site:reddit.com`), which costs SerpApi searches.
- Scoring time grows with hits (about 4 s per hit on gemma3:4b): a full run may take
  several minutes. `SCOUT.maxHitsToScore` caps it at 150.
- Web results without a date are kept (can't apply the 30-day rule); SearXNG often has
  no date.
- Hits scored below the thresholds are not stored, so the next run scores them again.
- Quota check and insert are two queries; two very fast clicks could both pass.
