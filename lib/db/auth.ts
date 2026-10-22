import "server-only";

import { redirect } from "next/navigation";
import { SIGN_IN_PATH } from "@/lib/config";
import { createServerSupabase } from "./server";

export interface SessionUser {
  id: string;
  email: string | null;
}

/** Current user from verified JWT claims, or null when signed out. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims.sub) return null;
  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  return { id: data.claims.sub, email };
}

/** Like getSessionUser but redirects to sign-in when signed out. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(SIGN_IN_PATH);
  return user;
}
