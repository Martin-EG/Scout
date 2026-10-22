"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/config";
import type { Database } from "@/types/database";

/** Supabase client for Client Components. Uses only the public anon key. */
export function createBrowserSupabase() {
  const { url, anonKey } = getPublicEnv();
  return createBrowserClient<Database>(url, anonKey);
}
