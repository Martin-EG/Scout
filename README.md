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

Not built yet: venue discovery, search sources, scoring, drafting, the worker, the inbox,
UTM redirects.

## Architecture

```
app/          Next.js routes (thin). (auth)/sign-in, auth/confirm, projects/, dev/llm
components/   ui/ primitives (Button, Field, TagInput); auth/, projects/, dev/ features
lib/
  config.ts   env (Zod-validated) + all constants (models, quotas, limits)
  db/         Supabase clients: server (cookies), browser, service (service role);
              auth.ts (getSessionUser/requireUser), session.ts (proxy refresh),
              projects.ts (queries), projectInput.ts (form schema)
  llm/        LLMProvider interface, OllamaProvider, extractJSON, typed errors
  sources/    (next) reddit, hackernews, searxng, serpapi adapters -> Hit
  scout/      (next) pipeline steps
worker/       (next) poll loop over the runs table
supabase/
  migrations/ schema + RLS
  seed.ts     inserts the GlamVault project for a user
types/        domain.ts (Project, Venue, Lead, Draft, Run, Click, Hit), database.ts
tests/        vitest, mirrors lib/
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
4. Apply the migration: paste `supabase/migrations/20261021000000_init.sql` into the
   Supabase SQL editor and run it (or `pnpm dlx supabase db push` with a linked project).
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
