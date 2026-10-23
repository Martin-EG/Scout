import { LINKS } from "@/lib/config";

const CODE_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** "r/MakeupRehab" -> "r-makeuprehab", "#ProjectPan" -> "projectpan", "Hacker News" -> "hacker-news". */
export function venueSlug(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "unknown"
  );
}

export interface UtmInput {
  /** Venue platform: reddit, hackernews, web, tiktok, instagram, ... */
  platform: string;
  venueName: string;
}

/** Project URL with Scout's UTM params. Existing query params are kept; utm_* are replaced. */
export function buildUtmUrl(projectUrl: string, { platform, venueName }: UtmInput): string {
  const url = new URL(projectUrl);
  url.searchParams.set("utm_source", platform.toLowerCase());
  url.searchParams.set("utm_medium", LINKS.utmMedium);
  url.searchParams.set("utm_campaign", LINKS.utmCampaign);
  url.searchParams.set("utm_content", venueSlug(venueName));
  return url.toString();
}

/** Random base-62 code for /r/<code>. Web Crypto, so this module is safe in client bundles. */
export function generateShortCode(length: number = LINKS.shortCodeLength): string {
  // Rejection sampling: bytes >= 248 (4 * 62) would bias the first characters.
  const limit = Math.floor(256 / CODE_ALPHABET.length) * CODE_ALPHABET.length;
  let code = "";
  while (code.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (byte < limit && code.length < length) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
    }
  }
  return code;
}

export function shortLink(appUrl: string, code: string): string {
  return `${appUrl.replace(/\/+$/, "")}${LINKS.shortPathPrefix}${code}`;
}

export function isShortCode(value: string, length: number = LINKS.shortCodeLength): boolean {
  return value.length === length && [...value].every((ch) => CODE_ALPHABET.includes(ch));
}

/**
 * Swaps any bare mention of the project URL (with or without scheme, trailing
 * slash, or www.) for the tracking link, so clicks are counted.
 */
export function replaceProjectUrl(body: string, projectUrl: string, link: string): string {
  const { hostname, pathname } = new URL(projectUrl);
  const host = hostname.replace(/^www\./, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const path = pathname.replace(/\/+$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?:https?://)?(?:www\\.)?${host}${path}/?(?![\\w/-])`, "gi");
  return body.replace(pattern, link);
}
