import { LINKS } from "@/lib/config";
import { buildUtmUrl, generateShortCode, replaceProjectUrl, shortLink } from "@/lib/utm";

/**
 * Codes for one draft: the first is reserved up front (so the prompt can show
 * the link), later ones only after a collision.
 */
export function codeSequence(first: string = generateShortCode()): () => string {
  let used = false;
  return () => {
    if (used) return generateShortCode();
    used = true;
    return first;
  };
}

export interface TrackedDraftFields {
  body: string;
  utm_url: string;
  short_code: string;
}

/**
 * Draft fields for a given code: the UTM target and a body where the bare project
 * URL, or the link shown in the prompt, becomes this code's tracking link.
 */
export function trackedDraftFields(
  body: string,
  code: string,
  opts: { appUrl: string; projectUrl: string; platform: string; venueName: string; promptLink?: string },
): TrackedDraftFields {
  const link = shortLink(opts.appUrl, code);
  let tracked = replaceProjectUrl(body, opts.projectUrl, link);
  if (opts.promptLink && opts.promptLink !== link) tracked = tracked.split(opts.promptLink).join(link);
  return {
    body: tracked,
    utm_url: buildUtmUrl(opts.projectUrl, { platform: opts.platform, venueName: opts.venueName }),
    short_code: code,
  };
}

export const SHORT_CODE_ATTEMPTS = LINKS.shortCodeAttempts;
