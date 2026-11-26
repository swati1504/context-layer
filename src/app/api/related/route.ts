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
    return NextResponse.json({ items: scored.map(({ i, c }) => ({ url: i.url, source: i.source, title: c?.headline ?? i.title })) });
  } catch { return NextResponse.json({ items: [] }); }
}
