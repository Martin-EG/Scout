"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { HOME_PATH, SIGN_IN_PATH } from "@/lib/config";
import { createServerSupabase } from "@/lib/db/server";
import type { AuthFormState } from "@/components/auth/SignInForm";

const PASSWORD_MIN = 8;

const credentialsSchema = z.object({
  email: z.email("Enter a valid email."),
  password: z.string().min(PASSWORD_MIN, `Password needs at least ${PASSWORD_MIN} characters.`),
  intent: z.enum(["sign-in", "sign-up"]),
});

export async function authenticate(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    intent: formData.get("intent"),
  });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input.", email };
  }

  const supabase = await createServerSupabase();
  const { intent, password } = parsed.data;

  if (intent === "sign-up") {
    const origin = (await headers()).get("origin") ?? "";
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password,
      options: { emailRedirectTo: `${origin}/auth/confirm` },
    });
    if (error) {
      console.error("[auth] sign-up failed", { email: parsed.data.email, error: error.message });
      return { error: error.message, email };
    }
    // With email confirmation enabled there is no session until the link is clicked.
    if (!data.session) {
      return { message: "Check your email to confirm your account, then sign in.", email };
    }
    redirect(HOME_PATH);
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password,
  });
  if (error) {
    return { error: error.message, email };
  }
  redirect(HOME_PATH);
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect(SIGN_IN_PATH);
}
