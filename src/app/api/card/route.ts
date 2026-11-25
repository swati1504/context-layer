import { NextResponse } from "next/server";
import { fetchArticle, articleFromText, FetchError } from "@/lib/fetchArticle";
import { generateCard } from "@/lib/card";

export const maxDuration = 60;

// Spend guard (per server instance) + cache so repeat clicks cost nothing.
const DAILY_LIMIT = Number(process.env.DAILY_CARD_LIMIT ?? 300);
let day = new Date().toISOString().slice(0, 10);
let used = 0;
const cache = new Map<string, unknown>();

export async function POST(req: Request) {
  const { url, text } = await req.json().catch(() => ({}));
  try {
    const key = text ? "" : String(url ?? "");
    if (key && cache.has(key)) return NextResponse.json({ card: cache.get(key), cached: true });
    const today = new Date().toISOString().slice(0, 10);
    if (today !== day) { day = today; used = 0; }
    if (used >= DAILY_LIMIT) return NextResponse.json({ error: "limit", message: "Daily card limit reached. Try again tomorrow." }, { status: 429 });
    const article = text ? articleFromText(String(text)) : await fetchArticle(key);
    used++;
    const card = await generateCard(article);
    if (key) cache.set(key, card);
    return NextResponse.json({ card });
  } catch (e) {
    if (e instanceof FetchError) return NextResponse.json({ error: e.code, message: e.message }, { status: 422 });
    console.error("card route failed:", e instanceof Error ? `${e.name}: ${e.message}\n${e.stack}` : e);
    return NextResponse.json({ error: "server", message: "Could not build the card" }, { status: 500 });
  }
}
