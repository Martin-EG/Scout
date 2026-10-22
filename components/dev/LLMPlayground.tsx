"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";

export interface LLMTestState {
  prompt?: string;
  reply?: string;
  error?: string;
  model?: string;
  latencyMs?: number;
}

type RunAction = (prev: LLMTestState, formData: FormData) => Promise<LLMTestState>;

export function LLMPlayground({ action }: { action: RunAction }) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-3">
        <textarea
          name="prompt"
          rows={5}
          required
          defaultValue={state.prompt ?? "Reply with one sentence: what is a no-buy challenge?"}
          className={inputClass}
        />
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Waiting for model…" : "Send"}
          </Button>
        </div>
      </form>

      {(state.reply !== undefined || state.error) && (
        <section className="flex flex-col gap-2">
          <p className="text-xs text-zinc-500">
            {state.model}
            {state.latencyMs !== undefined && ` · ${state.latencyMs} ms`}
          </p>
          {state.error ? (
            <p className="text-sm text-red-600">{state.error}</p>
          ) : (
            <pre className="whitespace-pre-wrap rounded-md bg-zinc-100 p-3 text-sm dark:bg-zinc-900">
              {state.reply}
            </pre>
          )}
        </section>
      )}
    </div>
  );
}
