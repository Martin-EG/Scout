import { z } from "zod";

// ---- Constants (no magic numbers elsewhere) ----

/** Default Ollama models. Small Gemma for scoring, larger Gemma for drafts. Override via env. */
export const DEFAULT_SCORER_MODEL = "gemma3:4b";
export const DEFAULT_DRAFTER_MODEL = "gemma3:12b";
export const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
export const DEFAULT_SEARXNG_URL = "http://localhost:8080";

export const LLM = {
  /** completeJSON tries once, then retries this many times before throwing. */
  jsonRetries: 1,
  requestTimeoutMs: 120_000,
  defaultTemperature: 0.2,
  /** Max characters of raw model output kept on errors (for logs). */
  rawOutputLogChars: 500,
} as const;

export const QUOTAS = {
  runsPerUserPerDay: 3,
} as const;

export const VENUE_COOLDOWN_DAYS = 7;

// ---- Sources ----

/** Sent on every source request. Identifies Scout as a read-only research client. */
export const SOURCE_USER_AGENT = "ScoutLeadFinder/0.1 (read-only search; indie dev tool)";

export const SOURCES = {
  reddit: {
    baseUrl: "https://www.reddit.com",
    /** Unauthenticated JSON is limited to ~10 req/min; stay well under. */
    minIntervalMs: 7_000,
    timeoutMs: 15_000,
    resultsPerQuery: 25,
    /** Reddit's `t` window: posts from the last month. */
    timeWindow: "month",
  },
  hackernews: {
    baseUrl: "https://hn.algolia.com/api/v1",
    minIntervalMs: 1_000,
    timeoutMs: 15_000,
    resultsPerQuery: 20,
    maxAgeDays: 30,
  },
  searxng: {
    minIntervalMs: 2_000,
    timeoutMs: 20_000,
    resultsPerQuery: 10,
  },
  serpapi: {
    baseUrl: "https://serpapi.com/search.json",
    minIntervalMs: 1_000,
    timeoutMs: 30_000,
    resultsPerQuery: 10,
    /** Google `tbs` filter: past month. */
    timeFilter: "qdr:m",
    /** SerpApi searches are metered; cap direct web queries per run (reddit fallback is extra). */
    maxWebQueriesPerRun: 4,
  },
} as const;

// ---- Scout pipeline ----

export const SCOUT = {
  minQueries: 10,
  maxQueries: 20,
  /** Hits older than this are dropped before and after scoring. */
  maxHitAgeDays: 30,
  minRelevance: 6,
  minIntent: 5,
  scoreBatchSize: 5,
  /** Upper bound on hits sent to the scorer per run (newest first). */
  maxHitsToScore: 150,
  /** Characters of each hit's snippet shown to the scorer. */
  scoreSnippetChars: 600,
  /** Max characters stored for a lead snippet and reason. */
  leadSnippetChars: 1_000,
  reasonChars: 400,
  /** Planning uses the larger model: one call per run, quality matters more than speed. */
  plannerTemperature: 0.4,
  scorerTemperature: 0.1,
  /** Listing pages, never conversations: dropped before scoring (the project's own domain is too). */
  skipDomains: ["apps.apple.com", "play.google.com", "chromewebstore.google.com", "producthunt.com"],
} as const;

export const WORKER = {
  pollIntervalMs: 5_000,
} as const;

/** Runs list on the projects page. */
export const RUNS_UI = {
  pollIntervalMs: 5_000,
  recentRunsShown: 5,
} as const;

export const PROJECT_LIMITS = {
  nameMax: 120,
  textMax: 2000,
  shortTextMax: 200,
  keywordMax: 80,
  keywordsPerLanguageMax: 30,
} as const;

/** Routes reachable without a session. Everything else redirects to sign-in. */
export const PUBLIC_PATHS = ["/sign-in", "/auth/confirm"] as const;
export const SIGN_IN_PATH = "/sign-in";
export const HOME_PATH = "/projects";

// ---- Environment ----

const serverEnvSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  /** Required only by the worker and seed script (see getServiceRoleKey). */
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  OLLAMA_BASE_URL: z.url().default(DEFAULT_OLLAMA_BASE_URL),
  SCORER_MODEL: z.string().min(1).default(DEFAULT_SCORER_MODEL),
  DRAFTER_MODEL: z.string().min(1).default(DEFAULT_DRAFTER_MODEL),
  SEARXNG_URL: z.url().default(DEFAULT_SEARXNG_URL),
  /** Required only when the SerpApi source runs. */
  SERPAPI_KEY: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | undefined;

/** Empty strings in .env files mean "unset". */
function readVar(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value !== undefined && value !== "") return value;
  }
  return undefined;
}

/** Server-side env, validated once. Throws with every invalid key listed. */
export function getEnv(): ServerEnv {
  if (cachedEnv) return cachedEnv;
  const parsed = serverEnvSchema.safeParse({
    // NEXT_PUBLIC_* / PUBLISHABLE_KEY accepted as aliases for existing Supabase setups.
    SUPABASE_URL: readVar("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
    SUPABASE_ANON_KEY: readVar(
      "SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ),
    SUPABASE_SERVICE_ROLE_KEY: readVar("SUPABASE_SERVICE_ROLE_KEY"),
    OLLAMA_BASE_URL: readVar("OLLAMA_BASE_URL"),
    SCORER_MODEL: readVar("SCORER_MODEL"),
    DRAFTER_MODEL: readVar("DRAFTER_MODEL"),
    SEARXNG_URL: readVar("SEARXNG_URL"),
    SERPAPI_KEY: readVar("SERPAPI_KEY"),
  });
  if (!parsed.success) {
    const keys = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid environment variables: ${keys}. See .env.example.`);
  }
  cachedEnv = parsed.data;
  return cachedEnv;
}

export function getServiceRoleKey(): string {
  const key = getEnv().SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for this command.");
  return key;
}

const publicEnvSchema = z.object({
  url: z.url(),
  anonKey: z.string().min(1),
});

/**
 * Browser-safe Supabase settings. next.config.ts copies SUPABASE_URL and
 * SUPABASE_ANON_KEY into these NEXT_PUBLIC_ names at build time.
 */
export function getPublicEnv(): z.infer<typeof publicEnvSchema> {
  return publicEnvSchema.parse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
