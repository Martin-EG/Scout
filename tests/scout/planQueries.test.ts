import { describe, expect, it } from "vitest";
import { queryPlanSchema } from "@/lib/llm/schemas/queryPlan";
import { cleanQueries } from "@/lib/scout/planQueries";

describe("query plan schema", () => {
  it("normalizes model spellings of source and lang", () => {
    const plan = queryPlanSchema.parse({
      queries: [
        { text: "app para mi maquillaje", lang: "Spanish", source: "Reddit", why: "x" },
        { text: "makeup tracker", lang: "EN", source: "Hacker News" },
        { text: "duplicate lipstick", lang: "en", source: "google", why: "y" },
      ],
    });
    expect(plan.queries.map((q) => [q.lang, q.source, q.why])).toEqual([
      ["es", "reddit", "x"],
      ["en", "hn", ""],
      ["en", "web", "y"],
    ]);
  });

  it("rejects unknown sources", () => {
    expect(queryPlanSchema.safeParse({ queries: [{ text: "x y", lang: "en", source: "tiktok" }] }).success).toBe(
      false,
    );
  });

  it("cleanQueries drops duplicate text per source and caps", () => {
    const q = (text: string, source: "reddit" | "web") => ({ text, lang: "en", source, why: "" });
    expect(cleanQueries([q("A b", "reddit"), q("a B", "reddit"), q("a b", "web"), q("c d", "web")], 2)).toEqual([
      q("A b", "reddit"),
      q("a b", "web"),
    ]);
  });
});
