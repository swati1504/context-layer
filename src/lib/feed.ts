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
