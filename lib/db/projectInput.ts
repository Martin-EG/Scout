// Project form schema. Client-safe (no server imports): used by server actions
// and the seed script.
import { z } from "zod";
import { PROJECT_LIMITS as L } from "@/lib/config";

const text = (max: number) => z.string().trim().max(max);

const keywords = z
  .array(z.string().trim().min(1).max(L.keywordMax))
  .max(L.keywordsPerLanguageMax)
  .transform((list) => Array.from(new Set(list)));

export const projectInputSchema = z.object({
  name: text(L.nameMax).min(1, "Name is required."),
  url: z.url("Enter a full URL, e.g. https://example.com").max(L.shortTextMax),
  description: text(L.textMax),
  audience: text(L.textMax),
  problems: text(L.textMax),
  keywords_en: keywords,
  keywords_es: keywords,
  tone: text(L.shortTextMax),
  region: text(L.shortTextMax),
});

export type ProjectInput = z.infer<typeof projectInputSchema>;
export type ProjectField = keyof ProjectInput;
export type ProjectFieldErrors = Partial<Record<ProjectField, string>>;

/** Reads the project form. Tag inputs submit one hidden input per keyword. */
export function projectInputFromFormData(formData: FormData): Record<ProjectField, unknown> {
  const str = (key: ProjectField) => String(formData.get(key) ?? "");
  const list = (key: ProjectField) => formData.getAll(key).map(String);
  return {
    name: str("name"),
    url: str("url").trim(),
    description: str("description"),
    audience: str("audience"),
    problems: str("problems"),
    keywords_en: list("keywords_en"),
    keywords_es: list("keywords_es"),
    tone: str("tone"),
    region: str("region"),
  };
}

export function fieldErrorsFrom(error: z.ZodError): ProjectFieldErrors {
  const errors: ProjectFieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as ProjectField | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return errors;
}
