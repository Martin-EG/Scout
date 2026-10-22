/** Transport or API failure talking to the model server. */
export class LLMRequestError extends Error {
  readonly name = "LLMRequestError";
  constructor(
    message: string,
    readonly model: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export type LLMOutputErrorKind = "no_json" | "invalid_json" | "schema_mismatch";

/** Model replied, but not with JSON matching the schema, after all retries. */
export class LLMOutputError extends Error {
  readonly name = "LLMOutputError";
  constructor(
    message: string,
    readonly kind: LLMOutputErrorKind,
    readonly model: string,
    readonly attempts: number,
    /** Truncated last raw reply, for logs. */
    readonly rawOutput: string,
  ) {
    super(message);
  }
}
