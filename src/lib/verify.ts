// A claim is "verified" only if its quote appears verbatim in the fetched article text.
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

export function quoteExists(articleText: string, quote: string): boolean {
  const q = norm(quote).replace(/^["']|["']$/g, "");
  if (q.length < 20) return false; // too short to be meaningful evidence
  return norm(articleText).includes(q);
}
