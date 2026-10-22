// Hand-written Supabase Database type (same shape `supabase gen types` emits).
// Keep in sync with supabase/migrations.
import type { Click, Draft, Lead, Project, Run, Venue } from "./domain";

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type WithJsonQueries<T> = Omit<T, "queries"> & { queries: Json };

/** Columns with DB defaults become optional on insert. */
type Table<Row, DefaultedKeys extends keyof Row> = {
  Row: Row;
  Insert: Omit<Row, DefaultedKeys> & Partial<Pick<Row, DefaultedKeys>>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      projects: Table<Project, "id" | "created_at" | "user_id">;
      venues: Table<
        Venue,
        "id" | "url" | "rules" | "link_policy" | "fit_score" | "status" | "last_posted_at"
      >;
      leads: Table<
        Lead,
        | "id"
        | "venue_id"
        | "run_id"
        | "snippet"
        | "posted_at"
        | "intent_score"
        | "relevance_score"
        | "reason"
        | "status"
        | "created_at"
      >;
      drafts: Table<
        Draft,
        "id" | "lead_id" | "venue_id" | "language" | "status" | "utm_url" | "posted_at" | "created_at"
      >;
      runs: Table<
        WithJsonQueries<Run>,
        | "id"
        | "status"
        | "started_at"
        | "finished_at"
        | "queries"
        | "hits_found"
        | "leads_kept"
        | "error"
        | "created_at"
      >;
      clicks: Table<Click, "id" | "venue_id" | "draft_id" | "clicked_at" | "referrer">;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
