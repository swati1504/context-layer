// Live feed from RSS of approved sources. Headlines and teasers come straight from the source.
export type FeedItem = { title: string; url: string; source: string; teaser: string; published: string };

const FEEDS: { source: string; url: string; filter?: RegExp }[] = [
  { source: "TechCrunch", url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
  { source: "The Verge", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml" },
  { source: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/technology-lab" },
  { source: "Wired", url: "https://www.wired.com/feed/tag/ai/latest/rss" },
];

const strip = (s: string) =>
  s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&#8216;/g, "‘").replace(/&#8220;|&#8221;/g, '"').replace(/&quot;/g, '"').replace(/&#039;|&#39;/g, "'")
    .replace(/&hellip;|&#8230;/g, "…").replace(/\s+/g, " ").trim();
const tag = (block: string, name: string) => block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"))?.[1] ?? "";

async function readFeed(f: (typeof FEEDS)[number]): Promise<FeedItem[]> {
  const res = await fetch(f.url, { headers: { "user-agent": "Mozilla/5.0 (compatible; ContextLayerBot/0.1)" }, next: { revalidate: 900 }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`${f.source} ${res.status}`);
  const xml = await res.text();
  const items = xml.match(/<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi) ?? [];
  return items.slice(0, 8).map((b) => {
    const link = strip(tag(b, "link")) || b.match(/<link[^>]*href="([^"]+)"/i)?.[1] || "";
    const desc = strip(tag(b, "description") || tag(b, "summary") || tag(b, "content"));
    return {
      title: strip(tag(b, "title")),
      url: link,
      source: f.source,
      teaser: desc.length > 180 ? desc.slice(0, 177).replace(/\s+\S*$/, "") + "…" : desc,
      published: strip(tag(b, "pubDate") || tag(b, "published") || tag(b, "updated")),
    };
  }).filter((i) => i.title && i.url);
}

export async function getFeed(): Promise<FeedItem[]> {
  const results = await Promise.allSettled(FEEDS.map(readFeed));
  const all = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const seen = new Set<string>();
  return all
    .filter((i) => (seen.has(i.url) ? false : (seen.add(i.url), true)))
    .sort((a, b) => +new Date(b.published) - +new Date(a.published))
    .slice(0, 20);
}

// Group stories about the same thing (similar headlines) into one row with "also covered by".
export type Story = FeedItem & { also: { source: string; url: string }[] };
const STOP = new Set(["the", "a", "an", "to", "of", "in", "for", "and", "on", "is", "its", "it", "as", "at", "by", "with", "from", "that", "this", "new", "says", "will", "are", "be", "how", "what", "why"]);
const words = (t: string) => new Set(t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
function similar(a: Set<string>, b: Set<string>) {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n >= 3 && n / Math.min(a.size, b.size) >= 0.5;
}
export function groupStories(items: FeedItem[]): Story[] {
  const out: (Story & { w: Set<string> })[] = [];
  for (const it of items) {
    const w = words(it.title);
    const g = out.find((o) => o.source !== it.source && similar(o.w, w));
    if (g) g.also.push({ source: it.source, url: it.url });
    else out.push({ ...it, also: [], w });
  }
  return out.map(({ w, ...s }) => { void w; return s; });
}
