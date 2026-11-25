import { NextResponse } from "next/server";
import { FetchError } from "@/lib/fetchArticle";
import { buildCard, buildFromText, lookupCard, LimitError } from "@/lib/cardService";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { url, text, title } = await req.json().catch(() => ({}));
  try {
    if (text) return NextResponse.json({ card: await buildFromText(String(text).slice(0, 40000), String(title ?? "Pasted text").slice(0, 200)) });
    const key = String(url ?? "").trim();
    if (!key) return NextResponse.json({ error: "bad_url", message: "Paste a link to a news story." }, { status: 422 });
    const hit = await lookupCard(key);
    if (hit) return NextResponse.json({ card: hit, cached: true });
    return NextResponse.json({ card: await buildCard(key) });
  } catch (e) {
    if (e instanceof LimitError) return NextResponse.json({ error: "limit", message: "Daily card limit reached. Try again tomorrow." }, { status: 429 });
    if (e instanceof FetchError) return NextResponse.json({ error: e.code, message: e.message }, { status: 422 });
    console.error("card route failed:", e instanceof Error ? `${e.name}: ${e.message}\n${e.stack}` : e);
    return NextResponse.json({ error: "server", message: "Could not build the card" }, { status: 500 });
  }
}
