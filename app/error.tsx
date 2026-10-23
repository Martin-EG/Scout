"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

/** Fallback for any page that throws (database down, expired session, bug). */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16 text-center">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Scout couldn&apos;t load this page. If it keeps happening, check that Supabase is reachable and
        your session hasn&apos;t expired.
      </p>
      <Button className="mt-6" onClick={() => retry()}>
        Try again
      </Button>
    </main>
  );
}
