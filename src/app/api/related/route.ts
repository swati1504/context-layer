import { NextResponse, connection } from "next/server";
import { getFeed } from "@/lib/feed";
import { lookupMany } from "@/lib/cardService";

const STOP = new Set(["the", "a", "an", "to", "of", "in", "for", "and", "on", "is", "its", "it", "as", "at", "by", "with", "from", "that", "this", "new", "says", "will", "are", "be", "how", "what", "why", "may", "could"]);
const words = (t: string) => new Set(t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
const overlap = (a: Set<string>, b: Set<string>) => { let n = 0; for (const w of a) if (b.has(w)) n++; return n; };

export async function GET(req: Request) {
  await connection();
  const q = new URL(req.url).searchParams;
  const url = q.get("u") ?? "";
  const title = q.get("t") ?? "";
  const tags = new Set((q.get("tags") ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
  try {
    const feed = (await getFeed()).filter((i) => i.url !== url);
    const cards = await lookupMany(feed.map((i) => i.url));
    const tw = words(title);
    const scored = feed.map((i) => {
      const c = cards[i.url];
      const ct = new Set((c?.tags ?? []).map((t: string) => t.toLowerCase()));
      const s = overlap(tags, ct) * 3 + overlap(tw, words(i.title));
      // Near-duplicates of the same story are not "related", they are the same story.
      const dup = overlap(tw, words(i.title)) >= 4;
      return { i, c, s, dup };
    }).filter((x) => !x.dup && x.s > 0).sort((a, b) => b.s - a.s).slice(0, 4);
    const clean = (t: string) => t.replace(/\s+[|\-–]\s+(TechCrunch|The Verge|Ars Technica|WIRED|Wired)$/i, "");
    const map = ({ i, c }: { i: (typeof feed)[number]; c?: { headline?: string } }) => ({ url: i.url, source: i.source, title: clean(c?.headline ?? i.title) });
    if (scored.length >= 2) return NextResponse.json({ kind: "related", items: scored.map(map) });
    const used = new Set(scored.map((x) => x.i.url));
    const more = feed.filter((i) => !used.has(i.url) && overlap(tw, words(i.title)) < 4).slice(0, 3 - scored.length).map((i) => ({ i, c: cards[i.url] }));
    return NextResponse.json({ kind: scored.length ? "related" : "more", items: [...scored, ...more].map(map) });
  } catch { return NextResponse.json({ items: [] }); }
}
