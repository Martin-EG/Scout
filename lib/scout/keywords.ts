// Cheap relevance gate before the LLM: a hit must mention the project's keywords.
import type { Hit, Project } from "@/types/domain";
import { SCOUT } from "@/lib/config";

/** Function words (EN/ES) and words too generic to signal a topic on their own. */
const STOPWORDS = new Set([
  // English
  "the", "and", "for", "you", "your", "with", "that", "this", "are", "was", "but", "not", "have",
  "has", "had", "all", "any", "can", "how", "what", "who", "why", "out", "get", "one", "own",
  "app", "apps", "best", "help", "need", "want", "use", "using", "tips", "new", "free", "same",
  "project", "track", "tracker", "tracking",
  // Spanish
  "que", "los", "las", "del", "con", "por", "para", "una", "uno", "mis", "mismo", "misma",
  "como", "pero", "mas", "app", "aplicacion", "compre",
]);

const MIN_TOKEN_LENGTH = 3;

/** Lowercase, accents removed, hyphens and punctuation as spaces. */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Meaningful words of a text, with a trailing plural "s" dropped. */
export function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(" ")
    .filter((word) => word.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(word))
    .map((word) => (word.length > MIN_TOKEN_LENGTH + 1 && word.endsWith("s") ? word.slice(0, -1) : word));
}

export interface KeywordIndex {
  /** Normalized multi-word keywords ("makeup collection", "no buy"). */
  phrases: string[];
  tokens: Set<string>;
}

export function buildKeywordIndex(project: Pick<Project, "name" | "keywords_en" | "keywords_es">): KeywordIndex {
  const keywords = [project.name, ...project.keywords_en, ...project.keywords_es];
  return {
    phrases: keywords.map(normalizeText).filter((phrase) => phrase.includes(" ")),
    tokens: new Set(keywords.flatMap(tokenize)),
  };
}

/**
 * True when the hit's title + snippet contains a keyword phrase, or at least
 * `minTokens` distinct keyword words.
 */
export function matchesKeywords(
  hit: Pick<Hit, "title" | "snippet">,
  index: KeywordIndex,
  minTokens: number = SCOUT.minKeywordTokenOverlap,
): boolean {
  const text = normalizeText(`${hit.title} ${hit.snippet}`);
  if (index.phrases.some((phrase) => ` ${text} `.includes(` ${phrase} `))) return true;
  const found = new Set(tokenize(text).filter((token) => index.tokens.has(token)));
  return found.size >= minTokens;
}
