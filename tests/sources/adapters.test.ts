import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { SOURCE_USER_AGENT } from "@/lib/config";
import { parseLooseDate } from "@/lib/sources/dates";
import { HackerNewsSource, mapHackerNewsResponse } from "@/lib/sources/hackernews";
import { mapRedditResponse, RedditSource } from "@/lib/sources/reddit";
import { mapSearxngResponse } from "@/lib/sources/searxng";
import { mapSerpApiResponse } from "@/lib/sources/serpapi";
import { SourceBlockedError, SourceError } from "@/lib/sources/types";
import { venueFromUrl } from "@/lib/sources/venue";

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(path.join(import.meta.dirname, "../fixtures/sources", name), "utf8"));
const NOW = Date.parse("2026-10-21T12:00:00Z");

describe("reddit mapping", () => {
  const hits = mapRedditResponse(fixture("reddit.json"));

  it("maps posts to hits with subreddit venues and permalink urls", () => {
    expect(hits).toHaveLength(2);
    expect(hits[0]).toEqual({
      source: "reddit",
      url: "https://www.reddit.com/r/MakeupRehab/comments/1x2y3z/is_there_an_app_that_tells_me_if_i_already_own_a/",
      title: "Is there an app that tells me if I already own a shade?",
      snippet: "I keep buying the same nude lipstick. I want something on my phone I can check in the store.",
      author: "lipsticklover22",
      postedAt: new Date(1792000000 * 1000).toISOString(),
      venueName: "r/MakeupRehab",
      venueUrl: "https://www.reddit.com/r/MakeupRehab/",
    });
  });

  it("uses the permalink (not the linked image) and drops deleted authors", () => {
    expect(hits[1].url).toBe("https://www.reddit.com/r/Sephora/comments/1a1b1c/haul_from_the_vib_sale/");
    expect(hits[1].author).toBeUndefined();
  });

  it("rejects an unexpected shape", () => {
    expect(() => mapRedditResponse({ nope: true })).toThrow(SourceError);
  });
});

describe("hacker news mapping", () => {
  const hits = mapHackerNewsResponse(fixture("hn.json"));

  it("links every hit to its HN item and uses the HN venue", () => {
    for (const hit of hits) {
      expect(hit.url).toMatch(/^https:\/\/news\.ycombinator\.com\/item\?id=\d+$/);
      expect(hit).toMatchObject({ source: "hackernews", venueName: "Hacker News" });
    }
  });

  it("titles comments after their story and strips HTML from the text", () => {
    const comment = hits[0];
    expect(comment.title).toBe("Comment on: EA is shutting down BioWare");
    expect(comment.snippet).not.toMatch(/<p>|&#x27;/);
    expect(comment.postedAt).toBe("2026-10-21T21:37:50.000Z");
    expect(comment.author).toBe("mrandish");
  });

  it("keeps story titles", () => {
    expect(hits[1].title).toBe("Meta Reports Third Quarter 2026 Results");
  });
});

describe("searxng mapping", () => {
  const hits = mapSearxngResponse(fixture("searxng.json"), NOW);

  it("maps results with domain venues, and subreddit venues for reddit urls", () => {
    expect(hits[0]).toMatchObject({
      source: "searxng",
      title: "Free makeup inventory apps? : r/MakeupRehab - Reddit",
      venueName: "r/MakeupRehab",
    });
    expect(hits[0].postedAt).toBeUndefined();
    expect(hits[1]).toMatchObject({ venueName: "apps.apple.com", venueUrl: "https://apps.apple.com/" });
  });

  it("parses publishedDate when present", () => {
    expect(hits[3]).toMatchObject({ venueName: "blog.example.com", postedAt: "2026-10-12T00:00:00.000Z" });
  });
});

describe("serpapi mapping", () => {
  const hits = mapSerpApiResponse(fixture("serpapi.json"), NOW);

  it("maps organic results with domain venues and relative dates", () => {
    expect(hits).toHaveLength(4);
    expect(hits[0]).toMatchObject({ source: "serpapi", venueName: "apps.apple.com" });
    expect(hits[0].postedAt).toBe(new Date(NOW - 4 * 86_400_000).toISOString());
    expect(hits[2].postedAt).toBe(new Date("Oct 7, 2026").toISOString());
  });

  it("gives site:reddit.com results their subreddit venue", () => {
    expect(hits[3].venueName).toBe("r/MakeupAddiction");
    expect(hits[3]).not.toHaveProperty("postedAt");
  });

  it("treats a missing organic_results as no hits", () => {
    expect(mapSerpApiResponse({ search_metadata: {} }, NOW)).toEqual([]);
  });
});

describe("adapter transport", () => {
  it("sends the User-Agent and maps the body", async () => {
    const fetch = vi.fn(async () => Response.json(fixture("hn.json")));
    const hits = await new HackerNewsSource({ fetch: fetch as typeof globalThis.fetch, now: () => NOW }).search(
      "makeup app",
    );
    expect(hits).toHaveLength(3);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("tags=%28story%2Ccomment%29");
    expect(url).toContain(`created_at_i%3E${Math.floor(NOW / 1000) - 30 * 86_400}`);
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe(SOURCE_USER_AGENT);
  });

  it("throws SourceBlockedError on 403/429", async () => {
    const fetch = vi.fn(async () => new Response("blocked", { status: 403 }));
    await expect(new RedditSource({ fetch: fetch as typeof globalThis.fetch }).search("x")).rejects.toBeInstanceOf(
      SourceBlockedError,
    );
  });
});

describe("helpers", () => {
  it("venueFromUrl", () => {
    expect(venueFromUrl("https://www.reddit.com/r/Makeup/comments/1/x/")).toEqual({
      venueName: "r/Makeup",
      venueUrl: "https://www.reddit.com/r/Makeup/",
    });
    expect(venueFromUrl("https://www.Temptalia.com/post")).toEqual({
      venueName: "temptalia.com",
      venueUrl: "https://www.temptalia.com/",
    });
  });

  it("parseLooseDate", () => {
    expect(parseLooseDate("3 hours ago", NOW)).toBe(new Date(NOW - 3 * 3_600_000).toISOString());
    expect(parseLooseDate("1 week ago", NOW)).toBe(new Date(NOW - 7 * 86_400_000).toISOString());
    expect(parseLooseDate("yesterday-ish", NOW)).toBeUndefined();
    expect(parseLooseDate(null, NOW)).toBeUndefined();
  });
});
