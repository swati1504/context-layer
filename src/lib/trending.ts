// "Most popular" lists read straight from each outlet's own homepage. We show their ranking, not ours.
import { parseHTML } from "linkedom";

export type Trend = { title: string; url: string; source: string; rank: number; label: string };

const OUTLETS: { source: string; home: string; heading: RegExp; article: RegExp; label: string }[] = [
  { source: "TechCrunch", home: "https://techcrunch.com/", heading: /^most popular$/i, article: /techcrunch\.com\/20\d\d\/\d\d\/\d\d\//, label: "Most popular on TechCrunch" },
  { source: "The Verge", home: "https://www.theverge.com/", heading: /^most popular$/i, article: /theverge\.com\/[a-z-]+\/\d{6,}\//, label: "Most popular on The Verge" },
  { source: "Ars Technica", home: "https://arstechnica.com/", heading: /^most read$/i, article: /arstechnica\.com\/[a-z-]+\/20\d\d\/\d\d\//, label: "Most read on Ars Technica" },
  { source: "Wired", home: "https://www.wired.com/", heading: /^trending stories$/i, article: /wired\.com\/story\//, label: "Trending on Wired" },
];

async function readOutlet(o: (typeof OUTLETS)[number]): Promise<Trend[]> {
  const res = await fetch(o.home, { headers: { "user-agent": "Mozilla/5.0 (compatible; ContextLayerBot/0.1)" }, next: { revalidate: 1800 }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`${o.source} ${res.status}`);
  const { document } = parseHTML((await res.text()).slice(0, 3_000_000));
  const heads = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6,span,div,p")].filter((el: Element) => el.children.length === 0 && o.heading.test((el.textContent ?? "").trim()));
  for (const h of heads) {
    let node: Element | null = h;
    for (let depth = 0; node && depth < 6; depth++, node = node.parentElement) {
      const links = [...node.querySelectorAll("a[href]")]
        .map((a: Element) => ({ href: new URL(a.getAttribute("href") ?? "", o.home).toString().replace(/[?#].*$/, ""), text: (a.textContent ?? "").replace(/\s+/g, " ").trim() }))
        .filter((l) => o.article.test(l.href) && l.text.length > 15);
      const seen = new Set<string>();
      const uniq = links.filter((l) => (seen.has(l.href) ? false : (seen.add(l.href), true)));
      if (uniq.length >= 3) return uniq.slice(0, 5).map((l, i) => ({ title: l.text, url: l.href, source: o.source, rank: i + 1, label: o.label }));
    }
  }
  return [];
}

let memo: { at: number; items: Trend[] } | null = null;

export async function getTrending(): Promise<Trend[]> {
  if (memo && Date.now() - memo.at < 30 * 60_000) return memo.items;
  const res = await Promise.allSettled(OUTLETS.map(readOutlet));
  const lists = res.map((r) => (r.status === "fulfilled" ? r.value : []));
  // Interleave by rank so every outlet's #1 comes first, then every #2.
  const items: Trend[] = [];
  for (let i = 0; i < 5; i++) for (const l of lists) if (l[i]) items.push(l[i]);
  if (items.length) memo = { at: Date.now(), items };
  return items;
}
