import { describe, expect, it } from "vitest";
import { isTooOld } from "@/lib/scout/rules";
import { calibrate, estimateRedditDates, fitIdTimeLine, redditPostId } from "@/lib/scout/redditAge";
import type { Hit } from "@/types/domain";

const DAY = 86_400_000;
const hit = (url: string, extra: Partial<Hit> = {}): Hit => ({
  source: "searxng",
  url,
  title: "t",
  snippet: "",
  venueName: "r/x",
  venueUrl: "https://www.reddit.com/r/x/",
  ...extra,
});
const thread = (id: string) => `https://www.reddit.com/r/MakeupRehab/comments/${id}/title`;

// Real (id, date) pairs from GlamVault runs, 2026-09-24 .. 2026-10-22.
const dated: Hit[] = [
  ["1woxq6e", "2026-09-24T10:12:16Z"],
  ["1wsmnbx", "2026-09-28T18:29:33Z"],
  ["1x053id", "2026-10-07T18:59:59Z"],
  ["1x4p25w", "2026-10-13T06:12:07Z"],
  ["1xc691n", "2026-10-22T02:10:40Z"],
].map(([id, postedAt]) => hit(thread(id), { source: "reddit", postedAt }));

describe("reddit id dates", () => {
  it("reads the base-36 post id from thread urls only", () => {
    expect(redditPostId(thread("1x4p25w"))).toBe(parseInt("1x4p25w", 36));
    expect(redditPostId("https://www.reddit.com/r/MakeupRehab/")).toBeNull();
    expect(redditPostId("https://example.com/comments/abc")).toBeNull();
  });

  it("estimates a held-out post within a day", () => {
    const line = calibrate(dated)!;
    const [estimated] = estimateRedditDates([hit(thread("1x1mg2o"))], line); // real: 2026-10-09T14:12:21Z
    expect(estimated.postedAtEstimated).toBe(true);
    expect(Math.abs(Date.parse(estimated.postedAt!) - Date.parse("2026-10-09T14:12:21Z"))).toBeLessThan(DAY);
  });

  it("puts years-old threads far outside the 30-day window", () => {
    const now = Date.parse("2026-10-23T00:00:00Z");
    const [old2021, old2023, recent] = estimateRedditDates(
      [hit(thread("q7p0v6")), hit(thread("17o397z")), hit(thread("1x97ntx"))],
      calibrate(dated),
    );
    expect(isTooOld(old2021, now, 30)).toBe(true);
    expect(isTooOld(old2023, now, 30)).toBe(true);
    expect(isTooOld(recent, now, 30)).toBe(false);
  });

  it("leaves dated, non-Reddit, and non-thread hits alone", () => {
    const keep = [dated[0], hit("https://example.com/post"), hit("https://www.reddit.com/r/nobuy")];
    expect(estimateRedditDates(keep, calibrate(dated))).toEqual(keep);
  });

  it("calibrates only on real Reddit-source dates, else falls back to config anchors", () => {
    const serpDated = hit(thread("1x4p25w"), { source: "serpapi", postedAt: "2020-01-01T00:00:00Z" });
    expect(calibrate([serpDated])).not.toBeNull(); // anchors
    expect(fitIdTimeLine([{ id: 1, time: 5 }])).toBeNull();
    expect(fitIdTimeLine([{ id: 1, time: 5 }, { id: 2, time: 3 }])).toBeNull(); // time going backwards
  });
});
