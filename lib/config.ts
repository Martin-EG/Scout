import { z } from "zod";

// ---- Constants (no magic numbers elsewhere) ----

/**
 * Default Ollama models, overridable via env. Scoring uses the 12b model too: in a
 * 42-lead A/B (README dev log, 2026-10-23) 4b kept off-topic posts that 12b rejected.
 */
export const DEFAULT_SCORER_MODEL = "gemma3:12b";
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

export const DEFAULT_APP_URL = "http://localhost:3000";

export const LINKS = {
  shortPathPrefix: "/r/",
  shortCodeLength: 7,
  /** Tries before giving up on a unique short code (collisions are rare at 62^7). */
  shortCodeAttempts: 3,
  utmMedium: "community",
  utmCampaign: "scout",
  /** Max characters kept from the Referer header. */
  referrerMax: 500,
} as const;

// ---- Sources ----

/** Sent on every source request. Identifies Scout as a read-only research client. */
export const SOURCE_USER_AGENT = "ScoutLeadFinder/0.1 (read-only search; indie dev tool)";

export const SOURCES = {
  reddit: {
    baseUrl: "https://www.reddit.com",
    /** Unauthenticated JSON is limited to ~10 req/min; stay well under. */
    minIntervalMs: 7_000,
    /** search.rss (used when JSON answers 403) allows 1 request per minute. */
    rssMinIntervalMs: 61_000,
    /** RSS is slow at 1/min; after this many queries the rest go to the SerpApi fallback. */
    rssMaxQueriesPerRun: 5,
    timeoutMs: 15_000,
    resultsPerQuery: 25,
    /** `new` matched any word loosely (r/Passports for "makeup" queries); relevance stays on topic. */
    sort: "relevance",
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
    /** Upstream engines (DuckDuckGo, Brave) throttle bursts; keep calls spaced. */
    minIntervalMs: 4_000,
    timeoutMs: 20_000,
    resultsPerQuery: 10,
  },
  serpapi: {
    baseUrl: "https://serpapi.com/search.json",
    minIntervalMs: 1_000,
    timeoutMs: 30_000,
    resultsPerQuery: 10,
    /** Google `tbs` filter: past month. Google ignores site restrictions when it is set. */
    timeFilter: "qdr:m",
    /** Fixed UI language so dates come back in English ("3 days ago") and parse. */
    uiLanguage: "en",
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
  /** The 12b planner can need >2 min on a cold start (model load + ~20 queries). */
  plannerTimeoutMs: 300_000,
  scorerTemperature: 0.1,
  /** Per batch. gemma3:12b needs ~50 s for 5 hits, more under load; 4b far less. */
  scorerTimeoutMs: 240_000,
  /**
   * Reddit post ids are base-36 and increase with time. Undated Reddit hits get a date
   * from a line fit through the run's dated Reddit posts; these anchors (observed
   * 2026-10) are used when the run has fewer than two.
   */
  redditIdAnchors: [
    { id: "1woxq6e", postedAt: "2026-09-24T10:12:16Z" },
    { id: "1xc691n", postedAt: "2026-10-22T02:10:40Z" },
  ],
  /**
   * Keyword pre-filter: a hit must contain one of the project's keyword phrases, or at
   * least this many distinct keyword words, before it reaches the scorer.
   */
  minKeywordTokenOverlap: 2,
  /** Listing pages, never conversations: dropped before scoring (the project's own domain is too). */
  skipDomains: ["apps.apple.com", "play.google.com", "chromewebstore.google.com", "producthunt.com"],
  /**
   * Video and social sites whose search results come without dates and are mostly
   * creators, not people asking for help: undated hits from them are dropped.
   */
  undatedSocialDomains: ["tiktok.com", "instagram.com", "youtube.com", "youtu.be"],
  /** Facebook paths that are videos or reels (group posts stay). */
  facebookVideoPath: /\/(videos|reel|watch)\b/,
} as const;

export const DRAFTS = {
  /** Leads drafted per run, highest intent first (includes earlier undrafted leads). */
  maxPerRun: 15,
  /** Undrafted leads fetched per run before the age check trims them to maxPerRun. */
  candidatesPerRun: 60,
  maxWords: 120,
  temperature: 0.6,
  /** Manual venue suggestions per run (platforms without search APIs). */
  manualVenuesMax: 8,
  /** link_policy values that allow a link in the reply. Anything else (or none) means no link. */
  linkAllowedPolicies: ["allowed", "links allowed", "yes"],
  /**
   * Phrases that count as the disclosure, matched on lowercase accent-free text.
   * A draft without one is rejected and retried.
   */
  disclosureMarkers: [
    "i built", "i made", "i created", "i developed", "i m building", "i am building", "i m the dev",
    "lo hice", "la hice", "lo cree", "la cree", "lo construi", "la construi", "lo desarrolle",
    "la desarrolle", "estoy construyendo", "soy la desarrolladora", "soy el desarrollador",
  ],
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
export const PUBLIC_PATHS = ["/sign-in", "/auth/confirm", "/r"] as const;
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
  /** Public origin of this app, used to build /r/<code> tracking links in drafts. */
  APP_URL: z.url().default(DEFAULT_APP_URL),
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
    APP_URL: readVar("APP_URL"),
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
