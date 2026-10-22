// Venue = where a conversation lives. Reddit URLs map to their subreddit so
// results from Reddit, SearXNG, and SerpApi land on the same venue.

export interface VenueRef {
  venueName: string;
  venueUrl: string;
}

const SUBREDDIT_PATH = /^\/r\/([A-Za-z0-9_]+)/;

export function isRedditHost(host: string): boolean {
  return host === "reddit.com" || host.endsWith(".reddit.com");
}

export function subredditVenue(subreddit: string): VenueRef {
  return { venueName: `r/${subreddit}`, venueUrl: `https://www.reddit.com/r/${subreddit}/` };
}

/** Subreddit for Reddit URLs, bare domain (no www.) for everything else. */
export function venueFromUrl(rawUrl: string): VenueRef {
  const url = new URL(rawUrl);
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const subreddit = isRedditHost(host) ? SUBREDDIT_PATH.exec(url.pathname)?.[1] : undefined;
  if (subreddit) return subredditVenue(subreddit);
  return { venueName: host, venueUrl: `${url.protocol}//${url.hostname.toLowerCase()}/` };
}
