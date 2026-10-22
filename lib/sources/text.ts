const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Decodes XML/HTML character references once (Atom feeds escape their HTML content). */
export function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name: string) => ENTITIES[name.toLowerCase()] ?? match);
}

/** Plain text from the small HTML fragments search APIs return (HN comments, highlights). */
export function stripHtml(html: string): string {
  const withoutTags = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(br|p)\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(withoutTags).replace(/\s+/g, " ").trim();
}
