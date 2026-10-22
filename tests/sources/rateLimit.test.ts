import { describe, expect, it } from "vitest";
import { createRateLimiter } from "@/lib/sources/rateLimit";

describe("createRateLimiter", () => {
  it("spaces consecutive calls by the interval", async () => {
    let clock = 1_000;
    const waits: number[] = [];
    const limiter = createRateLimiter(
      500,
      () => clock,
      async (ms) => {
        waits.push(ms);
        clock += ms;
      },
    );
    await Promise.all([limiter(), limiter(), limiter()]);
    expect(waits).toEqual([500, 500]);
  });
});
