// Structured console logging for the pipeline. Context always names the project and run.

export interface LogContext {
  projectId: string;
  runId: string;
  [key: string]: unknown;
}

export const log = {
  info: (message: string, ctx: LogContext) => console.log(`[scout] ${message}`, ctx),
  warn: (message: string, ctx: LogContext) => console.warn(`[scout] ${message}`, ctx),
  error: (message: string, ctx: LogContext) => console.error(`[scout] ${message}`, ctx),
};

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
