import { getFeed } from "./feed";
import { lookupSource } from "./sources";

const STOP = new Set(["the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are", "as", "at", "by", "with", "after", "that", "this", "its", "it", "from", "be", "has", "have"]);
const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w)));
// Both headlines must share nearly all their distinctive words, so a similar but different story is never matched.
function overlap(a: string, b: string) {
  const A = words(a), B = words(b);
  if (A.size < 3 || B.size < 3) return 0;
  let n = 0;
  for (const w of A) if (B.has(w)) n++;
  const cover = n / A.size, jac = n / (A.size + B.size - n);
  return cover >= 0.85 && jac >= 0.55 ? cover : 0;
}

// The headline is the first line of the transcribed screenshot (or its first sentence).
export function headlineOf(text: string): string {
  const first = text.split(/\n+/).map((l) => l.replace(/^(title|headline)\s*:\s*/i, "").trim()).find((l) => l.length > 12) ?? "";
  const h = first.length > 220 ? (first.match(/^.{20,220}?[.!?](\s|$)/)?.[0] ?? first.slice(0, 200)) : first;
  // Google News and search results append the outlet, for example "Headline - Reuters".
  return h.replace(/\s+[-–—|]\s+[^-–—|]{2,40}$/, "").trim();
}

const strip = (s: string) => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, " ").trim();

// Look the headline up in our own feed first, then in a news search, and return the best matching article link.
export async function findArticle(headline: string): Promise<string | null> {
  if (headline.length < 15) return null;
  try {
    const feed = await getFeed();
    let best = { s: 0, url: "" };
    for (const it of feed) { const s = overlap(headline, it.title); if (s > best.s) best = { s, url: it.url }; }
    if (best.s > 0) return best.url;
  } catch {}
  try {
    const res = await fetch(`https://www.bing.com/news/search?q=${encodeURIComponent(headline)}&format=rss`, { headers: { "user-agent": "Mozilla/5.0 (compatible; ContextLayerBot/0.1)" }, signal: AbortSignal.timeout(8000), next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const xml = await res.text();
    const cands: { s: number; url: string; approved: boolean }[] = [];
    for (const b of xml.match(/<item[\s\S]*?<\/item>/gi) ?? []) {
      const title = strip(b.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
      const link = strip(b.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ?? "");
      let url = link;
      try { const u = new URL(link); const t = u.searchParams.get("url"); if (t) url = t; } catch {}
      if (!/^https?:\/\//.test(url)) continue;
      const s = overlap(headline, title);
      if (s > 0) cands.push({ s, url, approved: !!lookupSource(url) });
    }
    cands.sort((a, b) => Number(b.approved) - Number(a.approved) || b.s - a.s);
    return cands[0]?.url ?? null;
  } catch { return null; }
}
