// Per-source spacing between requests. Calls queue up; each waits until at
// least `minIntervalMs` has passed since the previous one started.

export type RateLimiter = () => Promise<void>;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createRateLimiter(
  minIntervalMs: number,
  now: () => number = Date.now,
  sleep: (ms: number) => Promise<void> = defaultSleep,
): RateLimiter {
  let nextAllowedAt = 0;
  let queue: Promise<void> = Promise.resolve();

  return () => {
    const turn = queue.then(async () => {
      const wait = nextAllowedAt - now();
      if (wait > 0) await sleep(wait);
      nextAllowedAt = now() + minIntervalMs;
    });
    queue = turn.catch(() => undefined);
    return turn;
  };
}
