import { NextResponse, after, connection } from "next/server";
import { getFeed, groupStories } from "@/lib/feed";
import { buildCard, lookupMany } from "@/lib/cardService";

export const maxDuration = 60;

export async function GET(req: Request) {
  await connection();
  try {
    const dbg: Record<string, number | string> = {};
    const groups = groupStories(await getFeed(dbg));
    if (new URL(req.url).searchParams.get("debug")) return NextResponse.json({ feeds: dbg, total: groups.length, byTopic: Object.fromEntries([...new Set(groups.flatMap((g) => g.topics))].map((t) => [t, groups.filter((g) => g.topics.includes(t)).length])) });
    const cards = await lookupMany(groups.map((g) => g.url));
    const items = groups.map((g) => ({ ...g, card: cards[g.url] ?? null }));
    // Build cards for the top stories in the background so the first click is instant.
    // Take stories round-robin across topics so every interest gets a few ready cards.
    const pending = items.filter((i) => !i.card);
    const seen = new Set<string>();
    const todo: string[] = [];
    for (let round = 0; round < 2 && todo.length < 8; round++) {
      for (const t of new Set(pending.flatMap((i) => i.topics))) {
        const it = pending.find((p) => p.topics.includes(t) && !seen.has(p.url));
        if (it && todo.length < 8) { seen.add(it.url); todo.push(it.url); }
      }
    }
    for (const i of pending.slice(0, 3)) if (!seen.has(i.url) && todo.length < 8) todo.push(i.url);
    if (todo.length) after(async () => { for (const u of todo) { try { await buildCard(u); } catch {} } });
    return NextResponse.json({ items });
  } catch (e) {
    console.error("feed failed:", e);
    return NextResponse.json({ items: [] }, { status: 500 });
  }
}
