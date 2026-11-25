import { NextResponse } from "next/server";
import { fetchArticle, articleFromText, FetchError } from "@/lib/fetchArticle";
import { generateCard } from "@/lib/card";
import { getCachedCard, saveCard } from "@/lib/supabase";
import { takeBudget } from "@/lib/budget";

export const maxDuration = 60;
const cache = new Map<string, unknown>();
const isV2 = (c: unknown) => (c as { v?: number } | null)?.v === 2;

export async function POST(req: Request) {
  const { url, text, title } = await req.json().catch(() => ({}));
  try {
    const key = text ? "" : String(url ?? "").trim();
    if (key && isV2(cache.get(key))) return NextResponse.json({ card: cache.get(key), cached: true });
    if (key) {
      const stored = await getCachedCard(key);
      if (isV2(stored)) { cache.set(key, stored); return NextResponse.json({ card: stored, cached: true }); }
    }
    if (!takeBudget()) return NextResponse.json({ error: "limit", message: "Daily card limit reached. Try again tomorrow." }, { status: 429 });
    const article = text ? articleFromText(String(text), String(title ?? "Pasted text")) : await fetchArticle(key);
    const card = await generateCard(article);
    if (key) { cache.set(key, card); await saveCard(key, card); }
    return NextResponse.json({ card });
  } catch (e) {
    if (e instanceof FetchError) return NextResponse.json({ error: e.code, message: e.message }, { status: 422 });
    console.error("card route failed:", e instanceof Error ? `${e.name}: ${e.message}\n${e.stack}` : e);
    return NextResponse.json({ error: "server", message: "Could not build the card" }, { status: 500 });
  }
}
