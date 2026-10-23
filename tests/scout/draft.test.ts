import { describe, expect, it } from "vitest";
import { isInCooldown } from "@/lib/cooldown";
import { draftPrompt, linkPolicyAllowsLinks } from "@/lib/llm/prompts/draft";
import { draftSchema, manualVenuesSchema } from "@/lib/llm/schemas/draft";
import { checkedDraftSchema, draftProblems, hasDisclosure, selectLeadsToDraft, wordCount } from "@/lib/scout/draft";
import { selectNewVenues } from "@/lib/scout/manualVenues";
import type { Project } from "@/types/domain";

const project: Project = {
  id: "p",
  user_id: "u",
  name: "GlamVault",
  url: "https://try-glamvault.vercel.app/",
  description: "Beauty collection manager",
  audience: "",
  problems: "",
  keywords_en: [],
  keywords_es: [],
  tone: "friendly",
  region: "",
  created_at: "",
};
const lead = { title: "Is there an app to track my makeup?", snippet: "I keep rebuying shades", url: "https://x" };
const good =
  "Keep a simple list of shades you own and check it before buying. Swatching in daylight helps too. I built GlamVault for exactly this, happy to share the link.";

describe("draft schema", () => {
  it("parses body and normalizes language", () => {
    expect(draftSchema.parse({ body: " hi ", language: "ES-mx" })).toEqual({ body: "hi", language: "es" });
    expect(draftSchema.safeParse({ body: "", language: "en" }).success).toBe(false);
  });

  it("rejects drafts over 120 words or without a disclosure", () => {
    expect(checkedDraftSchema.safeParse({ body: good, language: "en" }).success).toBe(true);
    expect(checkedDraftSchema.safeParse({ body: "Try a spreadsheet.", language: "en" }).success).toBe(false);
    const long = `${"word ".repeat(121)}I built this.`;
    expect(draftProblems(long)).toEqual(["over 120 words"]);
  });

  it("recognizes English and Spanish disclosures", () => {
    expect(hasDisclosure("I built GlamVault for this.")).toBe(true);
    expect(hasDisclosure("I'm building an app for this")).toBe(true);
    expect(hasDisclosure("La creé yo: se llama GlamVault.")).toBe(true);
    expect(hasDisclosure("Lo construí para esto.")).toBe(true);
    expect(hasDisclosure("GlamVault is a great app.")).toBe(false);
    expect(wordCount("  one two\nthree ")).toBe(3);
  });
});

describe("link_policy in the prompt", () => {
  it("allows the link only for an explicit allowed policy", () => {
    expect(linkPolicyAllowsLinks("allowed")).toBe(true);
    expect(linkPolicyAllowsLinks(" Allowed ")).toBe(true);
    expect(linkPolicyAllowsLinks(null)).toBe(false);
    expect(linkPolicyAllowsLinks("no links")).toBe(false);
    expect(linkPolicyAllowsLinks("allowed on weekends")).toBe(false);
  });

  it("puts the tracking link in the prompt only when allowed", () => {
    const link = "http://localhost:3000/r/AbC1234";
    const allowed = draftPrompt({ project, lead, link, venue: { name: "r/x", rules: null, link_policy: "allowed" } });
    expect(allowed).toContain(`include the link ${link}`);
    const unknown = draftPrompt({ project, lead, link, venue: { name: "r/x", rules: null, link_policy: null } });
    expect(unknown).not.toContain(link);
    expect(unknown).toContain("happy to share the link");
    expect(draftPrompt({ project, lead, link, venue: null })).toContain("Do not include any link");
  });

  it("includes venue rules when present", () => {
    const prompt = draftPrompt({
      project,
      lead,
      link: "http://localhost:3000/r/AbC1234",
      venue: { name: "r/x", rules: "No self-promo on weekdays", link_policy: null },
    });
    expect(prompt).toContain("Venue rules: No self-promo on weekdays");
  });
});

describe("venue cooldown", () => {
  const now = Date.parse("2026-10-23T12:00:00Z");
  it("warns within 7 days of the last post", () => {
    expect(isInCooldown("2026-10-20T12:00:00Z", now)).toBe(true);
    expect(isInCooldown("2026-10-16T12:00:01Z", now)).toBe(true);
    expect(isInCooldown("2026-10-16T12:00:00Z", now)).toBe(false);
    expect(isInCooldown(null, now)).toBe(false);
  });
});

describe("manual venues", () => {
  const venue = (name: string, draft = "Follow #projectpan for empties. I built GlamVault to track a collection.") => ({
    platform: "tiktok" as const,
    name,
    why: "pan fans",
    draft,
    language: "en",
  });

  it("normalizes platform and falls back to other", () => {
    const parsed = manualVenuesSchema.parse({
      venues: [{ ...venue("#a"), platform: "TikTok" }, { ...venue("#b"), platform: "myspace" }],
    });
    expect(parsed.venues.map((v) => v.platform)).toEqual(["tiktok", "other"]);
  });

  it("skips existing names (case-insensitive), batch duplicates, and drafts breaking the rules", () => {
    const out = selectNewVenues(
      [venue("#ProjectPan"), venue("#nobuy"), venue("#NoBuy"), venue("#lowbuy", "Buy less makeup!")],
      ["#projectpan"],
    );
    expect(out.map((v) => v.name)).toEqual(["#nobuy"]);
  });
});

describe("selectLeadsToDraft", () => {
  const now = Date.parse("2026-10-23T12:00:00Z");
  const lead = (id: string, url: string, source: string, posted_at: string | null) => ({
    id,
    url,
    source,
    posted_at,
    title: "t",
    snippet: null,
    intent_score: 8,
    venue: null,
  });
  it("skips leads that are too old by stored or estimated Reddit date, then caps", () => {
    const leads = [
      lead("old-undated-2021", "https://www.reddit.com/r/MakeupRehab/comments/q7p0v6/x", "searxng", null),
      lead("recent", "https://www.reddit.com/r/ProjectPan/comments/1x8f307/x", "reddit", "2026-10-17T16:51:00Z"),
      lead("stale-dated", "https://www.reddit.com/r/ProjectPan/comments/1woxq6e/x", "reddit", "2026-09-01T10:12:16Z"),
      lead("blog", "https://example.com/post", "searxng", null),
      lead("recent2", "https://www.reddit.com/r/ProjectPan/comments/1x5u7cq/x", "reddit", "2026-10-14T15:26:49Z"),
    ];
    expect(selectLeadsToDraft(leads, now, 10).map((l) => l.id)).toEqual(["recent", "blog", "recent2"]);
    expect(selectLeadsToDraft(leads, now, 1).map((l) => l.id)).toEqual(["recent"]);
  });
});
