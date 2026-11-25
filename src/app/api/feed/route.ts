import { NextResponse, after, connection } from "next/server";
import { getFeed, groupStories } from "@/lib/feed";
import { buildCard, lookupMany } from "@/lib/cardService";

export const maxDuration = 60;

export async function GET() {
  await connection();
  try {
    const groups = groupStories(await getFeed());
    const cards = await lookupMany(groups.map((g) => g.url));
    const items = groups.map((g) => ({ ...g, card: cards[g.url] ?? null }));
    // Build cards for the top stories in the background so the first click is instant.
    const todo = items.slice(0, 6).filter((i) => !i.card).map((i) => i.url);
    if (todo.length) after(async () => { for (const u of todo) { try { await buildCard(u); } catch {} } });
    return NextResponse.json({ items });
  } catch (e) {
    console.error("feed failed:", e);
    return NextResponse.json({ items: [] }, { status: 500 });
  }
}
