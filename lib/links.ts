// Short-link redirect: /r/<code> -> log a click -> 302 to the draft's UTM URL.
// Store is injected so the logic is testable without a database.
import { LINKS } from "@/lib/config";
import { isShortCode } from "@/lib/utm";

export interface LinkTarget {
  draftId: string;
  projectId: string;
  venueId: string | null;
  utmUrl: string;
}

export interface LinkStore {
  findByCode(code: string): Promise<LinkTarget | null>;
  insertClick(click: { project_id: string; venue_id: string | null; draft_id: string; referrer: string | null }): Promise<void>;
}

export type ResolveResult = { kind: "redirect"; url: string } | { kind: "not_found" };

/** Looks up the code and records the click. A failed click insert never blocks the redirect. */
export async function resolveShortLink(
  store: LinkStore,
  code: string,
  referrer: string | null,
  onClickError: (err: unknown) => void = () => undefined,
): Promise<ResolveResult> {
  if (!isShortCode(code)) return { kind: "not_found" };
  const target = await store.findByCode(code);
  if (!target) return { kind: "not_found" };
  try {
    await store.insertClick({
      project_id: target.projectId,
      venue_id: target.venueId,
      draft_id: target.draftId,
      referrer: referrer ? referrer.slice(0, LINKS.referrerMax) : null,
    });
  } catch (err) {
    onClickError(err);
  }
  return { kind: "redirect", url: target.utmUrl };
}
