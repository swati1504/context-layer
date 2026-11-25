import { NextResponse } from "next/server";
import { FetchError } from "@/lib/fetchArticle";
import { LimitError } from "@/lib/cardService";
import { buildExplainer, lookupExplainer } from "@/lib/explainerService";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { url } = await req.json().catch(() => ({}));
  const key = String(url ?? "").trim();
  if (!key) return NextResponse.json({ error: "bad_url" }, { status: 422 });
  try {
    const hit = await lookupExplainer(key);
    if (hit) return NextResponse.json({ explainer: hit, cached: true });
    return NextResponse.json({ explainer: await buildExplainer(key) });
  } catch (e) {
    if (e instanceof LimitError) return NextResponse.json({ error: "limit" }, { status: 429 });
    if (e instanceof FetchError) return NextResponse.json({ error: e.code, message: e.message }, { status: 422 });
    console.error("explainer failed:", e instanceof Error ? `${e.name}: ${e.message}` : e);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
