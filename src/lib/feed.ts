// Live feed from RSS of approved sources. Headlines and teasers come straight from the source.
import { classify } from "./interests";
export type FeedItem = { title: string; url: string; source: string; teaser: string; published: string; topics: string[] };

// Each feed says which interest it mainly serves, so stories about health, money, kids and so on actually reach the feed.
const FEEDS: { source: string; url: string; hint?: string[]; take?: number }[] = [
  { source: "TechCrunch", url: "https://techcrunch.com/category/artificial-intelligence/feed/", take: 6 },
  { source: "The Verge", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", take: 6 },
  { source: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/technology-lab", take: 6 },
  { source: "Wired", url: "https://www.wired.com/feed/tag/ai/latest/rss", take: 5 },
  { source: "TechCrunch", url: "https://techcrunch.com/category/biotech-health/feed/", hint: ["Health and science"], take: 6 },
  { source: "TechCrunch", url: "https://techcrunch.com/category/fintech/feed/", hint: ["Money and business"], take: 6 },
  { source: "TechCrunch", url: "https://techcrunch.com/category/venture/feed/", hint: ["Startups", "Money and business"], take: 5 },
  { source: "TechCrunch", url: "https://techcrunch.com/category/security/feed/", hint: ["Security"], take: 5 },
  { source: "TechCrunch", url: "https://techcrunch.com/category/privacy/feed/", hint: ["Privacy"], take: 4 },
  { source: "TechCrunch", url: "https://techcrunch.com/category/government-policy/feed/", hint: ["Policy and law"], take: 5 },
  { source: "TechCrunch", url: "https://techcrunch.com/category/hardware/feed/", hint: ["Chips and hardware"], take: 5 },
  { source: "TechCrunch", url: "https://techcrunch.com/category/media-entertainment/feed/", hint: ["Creators and media"], take: 5 },
  { source: "TechCrunch", url: "https://techcrunch.com/category/apps/feed/", hint: ["Apps I use"], take: 4 },
  { source: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/science", hint: ["Health and science"], take: 4 },
  { source: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/tech-policy", hint: ["Policy and law"], take: 4 },
  { source: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/gadgets", hint: ["Chips and hardware"], take: 4 },
  { source: "Wired", url: "https://www.wired.com/feed/category/business/latest/rss", hint: ["Money and business"], take: 4 },
  { source: "Wired", url: "https://www.wired.com/feed/category/security/latest/rss", hint: ["Security"], take: 4 },
  { source: "Wired", url: "https://www.wired.com/feed/category/science/latest/rss", hint: ["Health and science"], take: 4 },
  { source: "The Verge", url: "https://www.theverge.com/rss/policy/index.xml", hint: ["Policy and law"], take: 4 },
  { source: "The Verge", url: "https://www.theverge.com/rss/science/index.xml", hint: ["Health and science"], take: 4 },
  { source: "CNBC", url: "https://www.cnbc.com/id/19854910/device/rss/rss.html", hint: ["Money and business"], take: 5 },
  { source: "CNBC", url: "https://www.cnbc.com/id/10000108/device/rss/rss.html", hint: ["Health and science"], take: 4 },
];

const strip = (s: string) =>
  s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, "&").replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&#8216;/g, "‘").replace(/&#8220;|&#8221;/g, '"').replace(/&quot;/g, '"').replace(/&#039;|&#39;/g, "'")
    .replace(/&hellip;|&#8230;/g, "…").replace(/\s+/g, " ").trim();
const tag = (block: string, name: string) => block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"))?.[1] ?? "";

export async function readFeed(f: (typeof FEEDS)[number]): Promise<FeedItem[]> {
  const res = await fetch(f.url, { headers: { "user-agent": "Mozilla/5.0 (compatible; ContextLayerBot/0.1)" }, next: { revalidate: 900 }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`${f.source} ${res.status}`);
  const xml = await res.text();
  const items = xml.match(/<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi) ?? [];
  return items.slice(0, f.take ?? 6).map((b) => {
    const link = strip(tag(b, "link")) || b.match(/<link[^>]*href="([^"]+)"/i)?.[1] || "";
    const desc = strip(tag(b, "description") || tag(b, "summary") || tag(b, "content"));
    const title = strip(tag(b, "title"));
    return {
      title,
      topics: classify(title + " " + desc, f.hint),
      url: link,
      source: f.source,
      teaser: desc.length > 180 ? desc.slice(0, 177).replace(/\s+\S*$/, "") + "…" : desc,
      published: strip(tag(b, "pubDate") || tag(b, "published") || tag(b, "updated")),
    };
  }).filter((i) => i.title && i.url);
}

export async function getFeed(debug?: Record<string, number | string>): Promise<FeedItem[]> {
  const results = await Promise.allSettled(FEEDS.map(readFeed));
  const byUrl = new Map<string, FeedItem>();
  results.forEach((r, i) => {
    if (debug) debug[FEEDS[i].url.replace("https://", "")] = r.status === "fulfilled" ? r.value.length : "FAILED " + String((r as PromiseRejectedResult).reason).slice(0, 40);
    if (r.status !== "fulfilled") return;
    for (const it of r.value) {
      const ex = byUrl.get(it.url);
      if (ex) ex.topics = [...new Set([...ex.topics, ...it.topics])];
      else byUrl.set(it.url, it);
    }
  });
  return [...byUrl.values()].sort((a, b) => +new Date(b.published) - +new Date(a.published)).slice(0, 70);
}
export const FEED_LIST = FEEDS;

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
    if (g) { g.also.push({ source: it.source, url: it.url }); g.topics = [...new Set([...g.topics, ...it.topics])]; }
    else out.push({ ...it, also: [], w });
  }
  return out.map(({ w, ...s }) => { void w; return s; });
}
