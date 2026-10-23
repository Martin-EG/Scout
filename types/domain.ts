// Shared domain types. Mirror supabase/migrations exactly.

export type VenueKind = "searchable" | "manual";
export type VenueStatus = "watching" | "active" | "dead" | "banned";
export type LeadStatus = "new" | "drafted" | "dismissed";
export type DraftStatus = "pending" | "approved" | "posted" | "rejected";
export type RunStatus = "queued" | "running" | "done" | "failed";

export type Project = {
  id: string;
  user_id: string;
  name: string;
  url: string;
  description: string;
  audience: string;
  problems: string;
  keywords_es: string[];
  keywords_en: string[];
  tone: string;
  region: string;
  created_at: string;
};

export type Venue = {
  id: string;
  project_id: string;
  kind: VenueKind;
  platform: string;
  name: string;
  url: string | null;
  rules: string | null;
  link_policy: string | null;
  fit_score: number | null;
  status: VenueStatus;
  last_posted_at: string | null;
};

export type Lead = {
  id: string;
  project_id: string;
  venue_id: string | null;
  run_id: string | null;
  source: string;
  url: string;
  title: string;
  snippet: string | null;
  posted_at: string | null;
  intent_score: number | null;
  relevance_score: number | null;
  reason: string | null;
  status: LeadStatus;
  created_at: string;
};

export type Draft = {
  id: string;
  project_id: string;
  lead_id: string | null;
  venue_id: string | null;
  body: string;
  language: string;
  status: DraftStatus;
  utm_url: string | null;
  posted_at: string | null;
  created_at: string;
};

export type Run = {
  id: string;
  project_id: string;
  status: RunStatus;
  started_at: string | null;
  finished_at: string | null;
  queries: unknown;
  hits_found: number;
  leads_kept: number;
  error: string | null;
  /** Milliseconds per pipeline step (plan, search, score). */
  step_durations: StepDurations;
  created_at: string;
};

export type RunStep = "plan" | "search" | "score";
export type StepDurations = Partial<Record<RunStep, number>>;

export type Click = {
  id: string;
  project_id: string;
  venue_id: string | null;
  draft_id: string | null;
  clicked_at: string;
  referrer: string | null;
};

export type HitSource = "reddit" | "hackernews" | "searxng" | "serpapi";

/** A search result, the common output of every lib/sources adapter. */
export type Hit = {
  source: HitSource;
  url: string;
  title: string;
  snippet: string;
  author?: string;
  /** ISO 8601. Missing when the source gives no date (common for web results). */
  postedAt?: string;
  /** True when postedAt was estimated (Reddit id), not given by the source. Not stored. */
  postedAtEstimated?: boolean;
  /** Where the conversation lives: "r/MakeupAddiction", "Hacker News", "example.com". */
  venueName: string;
  venueUrl: string;
};
