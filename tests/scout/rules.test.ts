import { describe, expect, it } from "vitest";
import {
  applyScoreRules,
  isSkippedDomain,
  isTooOld,
  isUndatedSocialVideo,
  passesScoreRules,
  selectHitsToScore,
  type ScoredHit,
} from "@/lib/scout/rules";
import { scoreBatchSchema } from "@/lib/llm/schemas/score";
import { matchScores, chunk } from "@/lib/scout/score";
import type { Hit } from "@/types/domain";

const NOW = Date.parse("2026-10-21T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
const T = { maxAgeDays: 30, minRelevance: 6, minIntent: 5 };

const base: Hit = {
  source: "reddit",
  url: "https://www.reddit.com/r/x/comments/1/t",
  title: "t",
  snippet: "",
  venueName: "r/x",
  venueUrl: "https://www.reddit.com/r/x/",
};
const scored = (over: Partial<ScoredHit>): ScoredHit => ({
  ...base,
  authorType: "person",
  relevance: 8,
  intent: 8,
  reason: "r",
  postedAt: daysAgo(1),
  ...over,
});

describe("score rules", () => {
  it("keeps hits at exactly the thresholds", () => {
    expect(passesScoreRules(scored({ relevance: 6, intent: 5 }), NOW, T)).toBe(true);
  });

  it("drops pages written by publishers", () => {
    expect(passesScoreRules(scored({ authorType: "publisher" }), NOW, T)).toBe(false);
  });

  it("drops low relevance or low intent", () => {
    expect(passesScoreRules(scored({ relevance: 5.9 }), NOW, T)).toBe(false);
    expect(passesScoreRules(scored({ intent: 4 }), NOW, T)).toBe(false);
  });

  it("drops hits older than 30 days but keeps undated ones", () => {
    expect(passesScoreRules(scored({ postedAt: daysAgo(31) }), NOW, T)).toBe(false);
    expect(passesScoreRules(scored({ postedAt: daysAgo(29) }), NOW, T)).toBe(true);
    expect(passesScoreRules(scored({ postedAt: undefined }), NOW, T)).toBe(true);
    expect(isTooOld({ postedAt: "garbage" }, NOW, 30)).toBe(false);
  });

  it("sorts kept hits by intent, then relevance", () => {
    const out = applyScoreRules(
      [
        scored({ url: "a", intent: 6, relevance: 9 }),
        scored({ url: "b", intent: 9, relevance: 6 }),
        scored({ url: "c", intent: 9, relevance: 8 }),
        scored({ url: "d", intent: 2, relevance: 10 }),
      ],
      NOW,
      T,
    );
    expect(out.map((h) => h.url)).toEqual(["c", "b", "a"]);
  });
});

describe("selectHitsToScore", () => {
  it("drops old hits, orders newest first with undated last, and caps", () => {
    const hits = [
      { ...base, url: "old", postedAt: daysAgo(40) },
      { ...base, url: "undated" },
      { ...base, url: "new", postedAt: daysAgo(1) },
      { ...base, url: "mid", postedAt: daysAgo(10) },
    ];
    expect(selectHitsToScore(hits, NOW, 10, 30).map((h) => h.url)).toEqual(["new", "mid", "undated"]);
    expect(selectHitsToScore(hits, NOW, 2, 30).map((h) => h.url)).toEqual(["new", "mid"]);
  });
});

describe("matchScores", () => {
  it("pairs scores to hits by normalized url and ignores unknown urls", () => {
    const batch = [base, { ...base, url: "https://example.com/b" }];
    const out = matchScores(batch, [
      {
        url: "https://old.reddit.com/r/x/comments/1/t/",
        author_type: "person",
        relevance: 7,
        intent: 6,
        reason: "asks for an app",
      },
      { url: "https://made-up.example/", author_type: "person", relevance: 9, intent: 9, reason: "hallucinated" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ url: base.url, authorType: "person", relevance: 7, intent: 6 });
  });

  it("reads unknown author types as publisher", () => {
    const parsed = scoreBatchSchema.parse({
      results: [
        { url: "a", author_type: "Person", relevance: "7", intent: 6 },
        { url: "b", author_type: "brand", relevance: 7, intent: 6 },
        { url: "c", relevance: 7, intent: 6 },
      ],
    });
    expect(parsed.results.map((r) => r.author_type)).toEqual(["person", "publisher", "publisher"]);
    expect(parsed.results[0].relevance).toBe(7);
  });

  it("chunks into batches", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});

describe("isSkippedDomain", () => {
  const project = "https://try-glamvault.vercel.app/";
  it("skips store listings and the project's own site", () => {
    expect(isSkippedDomain({ url: "https://apps.apple.com/us/app/x/id1" }, project)).toBe(true);
    expect(isSkippedDomain({ url: "https://www.producthunt.com/posts/x" }, project)).toBe(true);
    expect(isSkippedDomain({ url: "https://try-glamvault.vercel.app/features" }, project)).toBe(true);
  });
  it("keeps conversations", () => {
    expect(isSkippedDomain({ url: "https://www.reddit.com/r/MakeupRehab/comments/1/x" }, project)).toBe(false);
    expect(isSkippedDomain({ url: "https://notapps.apple.com.example/x" }, project)).toBe(false);
  });
});

describe("isUndatedSocialVideo", () => {
  it("drops undated TikTok, Instagram, YouTube, and Facebook videos/reels", () => {
    for (const url of [
      "https://www.tiktok.com/@x/video/1",
      "https://www.instagram.com/reel/Dd6oN6jBWjJ",
      "https://www.youtube.com/watch?v=abc",
      "https://m.youtube.com/watch?v=abc",
      "https://youtu.be/abc",
      "https://www.facebook.com/100092386157692/videos/slug/29815659161355704",
      "https://www.facebook.com/reel/123",
    ]) {
      expect(isUndatedSocialVideo({ url }), url).toBe(true);
    }
  });

  it("keeps dated ones, Facebook group posts, and other sites", () => {
    expect(isUndatedSocialVideo({ url: "https://www.youtube.com/watch?v=abc", postedAt: "2026-10-20T00:00:00Z" })).toBe(
      false,
    );
    expect(isUndatedSocialVideo({ url: "https://www.facebook.com/groups/7455827464472754/posts/28779663941662464" })).toBe(
      false,
    );
    expect(isUndatedSocialVideo({ url: "https://www.reddit.com/r/x/comments/1/t" })).toBe(false);
    expect(isUndatedSocialVideo({ url: "https://notyoutube.com/watch" })).toBe(false);
  });
});
