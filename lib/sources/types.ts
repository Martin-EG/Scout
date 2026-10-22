import type { Hit, HitSource } from "@/types/domain";

export interface SearchOptions {
  /** ISO 639-1 code from the query plan ("en", "es"). Sources that can't filter ignore it. */
  lang?: string;
}

export interface SourceAdapter {
  readonly source: HitSource;
  search(query: string, opts?: SearchOptions): Promise<Hit[]>;
}

/** Shared constructor options: injectable fetch and clock for tests. */
export interface AdapterDeps {
  fetch?: typeof fetch;
  now?: () => number;
}

/** Non-2xx response, timeout, network failure, or unexpected body. */
export class SourceError extends Error {
  readonly name: string = "SourceError";
  constructor(
    message: string,
    readonly source: HitSource,
    readonly status?: number,
  ) {
    super(message);
  }
}

/** The source refused us (403/429). Callers may fall back to another source. */
export class SourceBlockedError extends SourceError {
  readonly name = "SourceBlockedError";
}
