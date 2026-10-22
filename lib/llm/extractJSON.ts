// Pull a JSON value out of a model reply that may wrap it in prose or code fences.

export type ExtractResult =
  | { ok: true; value: unknown }
  | { ok: false; kind: "no_json" | "invalid_json"; message: string };

const FENCE = /```(?:json|JSON)?\s*\n?([\s\S]*?)```/g;

/** Returns the end index (inclusive) of the balanced object/array starting at `start`, or -1. */
function balancedEnd(text: string, start: number): number {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") stack.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") {
      if (stack.pop() !== ch) return -1;
      if (stack.length === 0) return i;
    }
  }
  return -1;
}

function tryParse(candidate: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(candidate) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Candidates in priority order: whole reply, fenced blocks, then balanced spans in prose. */
function candidates(text: string): string[] {
  const out = [text.trim()];
  for (const match of text.matchAll(FENCE)) out.push(match[1].trim());
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "{" && text[i] !== "[") continue;
    const end = balancedEnd(text, i);
    if (end !== -1) {
      out.push(text.slice(i, end + 1));
      i = end;
    }
  }
  return out;
}

export function extractJSON(text: string): ExtractResult {
  let lastError: string | null = null;
  for (const candidate of candidates(text)) {
    if (!candidate.startsWith("{") && !candidate.startsWith("[")) continue;
    const parsed = tryParse(candidate);
    if (parsed.ok) return { ok: true, value: parsed.value };
    lastError = parsed.error;
  }
  return lastError
    ? { ok: false, kind: "invalid_json", message: `Found JSON-like text but could not parse it: ${lastError}` }
    : { ok: false, kind: "no_json", message: "No JSON object or array found in the reply." };
}
