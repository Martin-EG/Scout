import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { HOME_PATH, SIGN_IN_PATH } from "@/lib/config";
import { createServerSupabase } from "@/lib/db/server";

// Email confirmation landing. Handles the default PKCE link (?code=) and
// custom templates that send ?token_hash=&type=.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createServerSupabase();
  let ok = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
    if (error) console.error("[auth] code exchange failed", { error: error.message });
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
    if (error) console.error("[auth] otp verify failed", { type, error: error.message });
  }

  const target = ok ? HOME_PATH : `${SIGN_IN_PATH}?error=confirm`;
  return NextResponse.redirect(new URL(target, origin));
}
