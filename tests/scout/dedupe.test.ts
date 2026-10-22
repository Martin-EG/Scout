import { describe, expect, it } from "vitest";
import { dedupeHits, normalizeUrl } from "@/lib/scout/dedupe";
import type { Hit } from "@/types/domain";

const hit = (url: string, extra: Partial<Hit> = {}): Hit => ({
  source: "searxng",
  url,
  title: "t",
  snippet: "",
  venueName: "example.com",
  venueUrl: "https://example.com/",
  ...extra,
});

describe("normalizeUrl", () => {
  it("strips utm_* and click-id params, keeps meaningful ones sorted", () => {
    expect(
      normalizeUrl("https://example.com/post?utm_source=x&b=2&fbclid=abc&a=1&utm_medium=y&gclid=z"),
    ).toBe("https://example.com/post?a=1&b=2");
  });

  it("strips trailing slashes, fragment, and default port; lowercases host; upgrades http", () => {
    expect(normalizeUrl("http://Example.COM:80/a/b///#comments")).toBe("https://example.com/a/b");
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com");
  });

  it("folds reddit hosts to www.reddit.com", () => {
    const canonical = "https://www.reddit.com/r/MakeupRehab/comments/abc/title";
    expect(normalizeUrl("https://old.reddit.com/r/MakeupRehab/comments/abc/title/")).toBe(canonical);
    expect(normalizeUrl("https://reddit.com/r/MakeupRehab/comments/abc/title/?utm_source=share")).toBe(
      canonical,
    );
    expect(normalizeUrl("https://np.reddit.com/r/MakeupRehab/comments/abc/title")).toBe(canonical);
  });

  it("keeps the HN item id param", () => {
    expect(normalizeUrl("https://news.ycombinator.com/item?id=123")).toBe(
      "https://news.ycombinator.com/item?id=123",
    );
  });

  it("returns unparseable input trimmed", () => {
    expect(normalizeUrl("  not a url ")).toBe("not a url");
  });
});

describe("dedupeHits", () => {
  it("drops hits whose normalized url is already a lead", () => {
    const existing = new Set(["https://example.com/a"]);
    const out = dedupeHits([hit("https://example.com/a/?utm_source=x"), hit("https://example.com/b")], existing);
    expect(out.map((h) => h.url)).toEqual(["https://example.com/b"]);
  });

  it("merges duplicates within a run, keeping the copy with a date", () => {
    const out = dedupeHits(
      [
        hit("https://www.reddit.com/r/x/comments/1/t/"),
        hit("https://old.reddit.com/r/x/comments/1/t", { source: "reddit", postedAt: "2026-10-01T00:00:00.000Z" }),
      ],
      new Set(),
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ source: "reddit", url: "https://www.reddit.com/r/x/comments/1/t" });
  });

  it("returns urls in normalized form", () => {
    expect(dedupeHits([hit("HTTP://EXAMPLE.com/x/")], new Set())[0].url).toBe("https://example.com/x");
  });
});
