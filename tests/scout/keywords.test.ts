import { describe, expect, it } from "vitest";
import { buildKeywordIndex, matchesKeywords, normalizeText, tokenize } from "@/lib/scout/keywords";

const index = buildKeywordIndex({
  name: "GlamVault",
  keywords_en: ["makeup collection", "duplicate lipstick", "no-buy", "project pan", "shade matching"],
  keywords_es: ["colección de maquillaje", "compré el mismo labial"],
});
const hit = (title: string, snippet = "") => ({ title, snippet });

describe("keyword pre-filter", () => {
  it("normalizes accents, case, and hyphens", () => {
    expect(normalizeText("Colección-de MAQUILLAJE!")).toBe("coleccion de maquillaje");
    expect(tokenize("My lipsticks and the shades")).toEqual(["lipstick", "shade"]);
  });

  it("passes a hit containing a keyword phrase", () => {
    expect(matchesKeywords(hit("Is there an app to track my makeup collection?"), index)).toBe(true);
    expect(matchesKeywords(hit("Starting a no buy for 2027"), index)).toBe(true);
    expect(matchesKeywords(hit("Mi colección de maquillaje creció demasiado"), index)).toBe(true);
  });

  it("passes a hit with two distinct keyword words", () => {
    expect(matchesKeywords(hit("Bought a lipstick", "turns out I had the same shade already"), index)).toBe(true);
  });

  it("drops off-topic hits and hits with a single or generic word", () => {
    expect(matchesKeywords(hit("My Claude Code setup", "runs like a small engineering team on my project"), index)).toBe(
      false,
    );
    expect(matchesKeywords(hit("How do you keep track of upcoming bills?"), index)).toBe(false);
    expect(matchesKeywords(hit("New makeup haul"), index)).toBe(false);
  });

  it("does not match phrases across word boundaries", () => {
    expect(matchesKeywords(hit("photo project panorama"), index)).toBe(false);
  });
});
