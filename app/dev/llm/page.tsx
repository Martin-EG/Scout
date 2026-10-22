import { notFound } from "next/navigation";
import { LLMPlayground } from "@/components/dev/LLMPlayground";
import { runPrompt } from "./actions";

export const metadata = { title: "LLM test · Scout" };

export default function DevLLMPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-xl font-semibold">LLM test</h1>
      <p className="mb-6 mt-1 text-sm text-zinc-500">
        Sends the prompt to SCORER_MODEL through OllamaProvider. Dev only.
      </p>
      <LLMPlayground action={runPrompt} />
    </main>
  );
}
