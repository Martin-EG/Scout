import { SOURCE_USER_AGENT } from "@/lib/config";
import type { HitSource } from "@/types/domain";
import { SourceBlockedError, SourceError } from "./types";

const BLOCKED_STATUSES = new Set([403, 429]);

export interface GetOptions {
  source: HitSource;
  timeoutMs: number;
  fetch: typeof fetch;
}

/** GET with Scout's User-Agent and a timeout. Throws SourceError (or SourceBlockedError on 403/429). */
async function get(url: string, accept: string, opts: GetOptions): Promise<Response> {
  let response: Response;
  try {
    response = await opts.fetch(url, {
      headers: { "User-Agent": SOURCE_USER_AGENT, Accept: accept },
      signal: AbortSignal.timeout(opts.timeoutMs),
      redirect: "follow",
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new SourceError(`${opts.source} request failed: ${reason}`, opts.source);
  }

  if (BLOCKED_STATUSES.has(response.status)) {
    throw new SourceBlockedError(
      `${opts.source} refused the request (HTTP ${response.status})`,
      opts.source,
      response.status,
    );
  }
  if (!response.ok) {
    throw new SourceError(`${opts.source} returned HTTP ${response.status}`, opts.source, response.status);
  }
  return response;
}

export async function getJSON(url: string, opts: GetOptions): Promise<unknown> {
  const response = await get(url, "application/json", opts);
  try {
    return await response.json();
  } catch {
    throw new SourceError(`${opts.source} returned a non-JSON body`, opts.source, response.status);
  }
}

export async function getText(url: string, accept: string, opts: GetOptions): Promise<string> {
  const response = await get(url, accept, opts);
  return response.text();
}
