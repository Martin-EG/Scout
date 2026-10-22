"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";

export interface AuthFormState {
  error?: string;
  message?: string;
  email?: string;
}

type AuthAction = (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;

const initialState: AuthFormState = {};

export function SignInForm({ action }: { action: AuthAction }) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const confirmFailed = useSearchParams().get("error") === "confirm";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Email" htmlFor="email">
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          className={inputClass}
        />
      </Field>
      <Field label="Password" htmlFor="password">
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </Field>

      {confirmFailed && !state.error && (
        <p className="text-sm text-red-600">That confirmation link is invalid or expired.</p>
      )}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.message && <p className="text-sm text-emerald-700">{state.message}</p>}

      <div className="flex gap-2">
        <Button type="submit" name="intent" value="sign-in" disabled={pending}>
          Sign in
        </Button>
        <Button type="submit" name="intent" value="sign-up" variant="secondary" disabled={pending}>
          Create account
        </Button>
      </div>
    </form>
  );
}
