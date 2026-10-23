import { describe, expect, it, vi } from "vitest";
import { resolveShortLink, type LinkStore } from "@/lib/links";
import { codeSequence, trackedDraftFields } from "@/lib/scout/trackedLink";
import { buildUtmUrl, generateShortCode, isShortCode, replaceProjectUrl, shortLink, venueSlug } from "@/lib/utm";

describe("utm building", () => {
  it("adds Scout's UTM params with a venue slug", () => {
    const url = new URL(buildUtmUrl("https://try-glamvault.vercel.app/", { platform: "Reddit", venueName: "r/MakeupRehab" }));
    expect(url.origin + url.pathname).toBe("https://try-glamvault.vercel.app/");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      utm_source: "reddit",
      utm_medium: "community",
      utm_campaign: "scout",
      utm_content: "r-makeuprehab",
    });
  });

  it("keeps existing params and replaces old utm values", () => {
    const url = new URL(
      buildUtmUrl("https://example.com/app?ref=x&utm_source=old", { platform: "tiktok", venueName: "#ProjectPan" }),
    );
    expect(url.searchParams.get("ref")).toBe("x");
    expect(url.searchParams.getAll("utm_source")).toEqual(["tiktok"]);
    expect(url.searchParams.get("utm_content")).toBe("projectpan");
  });

  it("slugs venue names", () => {
    expect(venueSlug("Hacker News")).toBe("hacker-news");
    expect(venueSlug("Colección de Maquillaje!")).toBe("coleccion-de-maquillaje");
    expect(venueSlug("###")).toBe("unknown");
  });

  it("generates valid short codes and links", () => {
    const code = generateShortCode();
    expect(isShortCode(code)).toBe(true);
    expect(isShortCode("abc")).toBe(false);
    expect(isShortCode("abc-123")).toBe(false);
    expect(shortLink("http://localhost:3000/", "AbC1234")).toBe("http://localhost:3000/r/AbC1234");
  });

  it("replaces bare project URLs in a draft with the tracking link", () => {
    const link = "http://localhost:3000/r/AbC1234";
    const project = "https://try-glamvault.vercel.app/";
    expect(replaceProjectUrl("Try https://try-glamvault.vercel.app/ now", project, link)).toBe(`Try ${link} now`);
    expect(replaceProjectUrl("See try-glamvault.vercel.app.", project, link)).toBe(`See ${link}.`);
    expect(replaceProjectUrl("Docs: https://try-glamvault.vercel.app/docs", project, link)).toBe(
      "Docs: https://try-glamvault.vercel.app/docs",
    );
    expect(replaceProjectUrl("no link here", project, link)).toBe("no link here");
  });

  it("builds tracked draft fields, swapping the prompt link after a code collision", () => {
    const opts = {
      appUrl: "http://localhost:3000",
      projectUrl: "https://try-glamvault.vercel.app/",
      platform: "reddit",
      venueName: "r/x",
      promptLink: "http://localhost:3000/r/AAAAAAA",
    };
    const fields = trackedDraftFields("Link: http://localhost:3000/r/AAAAAAA", "BBBBBBB", opts);
    expect(fields.body).toBe("Link: http://localhost:3000/r/BBBBBBB");
    expect(fields.short_code).toBe("BBBBBBB");
    expect(fields.utm_url).toContain("utm_content=r-x");
  });

  it("codeSequence returns the reserved code first, then fresh ones", () => {
    const next = codeSequence("AAAAAAA");
    expect(next()).toBe("AAAAAAA");
    const second = next();
    expect(second).not.toBe("AAAAAAA");
    expect(isShortCode(second)).toBe(true);
  });
});

describe("click logging", () => {
  const target = { draftId: "d1", projectId: "p1", venueId: "v1", utmUrl: "https://example.com/?utm_source=reddit" };

  function store(found: typeof target | null, insertClick = vi.fn(async () => undefined)) {
    return { findByCode: vi.fn(async () => found), insertClick } satisfies LinkStore;
  }

  it("records the click with project, venue, draft, and referrer, then redirects", async () => {
    const s = store(target);
    const result = await resolveShortLink(s, "AbC1234", "https://www.reddit.com/r/x/comments/1");
    expect(result).toEqual({ kind: "redirect", url: target.utmUrl });
    expect(s.insertClick).toHaveBeenCalledWith({
      project_id: "p1",
      venue_id: "v1",
      draft_id: "d1",
      referrer: "https://www.reddit.com/r/x/comments/1",
    });
  });

  it("returns not_found for unknown or malformed codes without logging", async () => {
    const s = store(null);
    expect(await resolveShortLink(s, "AbC1234", null)).toEqual({ kind: "not_found" });
    expect(await resolveShortLink(s, "../etc", null)).toEqual({ kind: "not_found" });
    expect(s.findByCode).toHaveBeenCalledTimes(1);
    expect(s.insertClick).not.toHaveBeenCalled();
  });

  it("still redirects when the click insert fails", async () => {
    const onError = vi.fn();
    const s = store(target, vi.fn(async () => Promise.reject(new Error("db down"))));
    expect(await resolveShortLink(s, "AbC1234", null, onError)).toEqual({ kind: "redirect", url: target.utmUrl });
    expect(onError).toHaveBeenCalledOnce();
  });
});
