// Service-role client: bypasses RLS. Worker, seed script, and trusted server
// routes only. Never import from client components.
import { createClient } from "@supabase/supabase-js";
import { getEnv, getServiceRoleKey } from "@/lib/config";
import type { Database } from "@/types/database";

export function createServiceSupabase() {
  return createClient<Database>(getEnv().SUPABASE_URL, getServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
