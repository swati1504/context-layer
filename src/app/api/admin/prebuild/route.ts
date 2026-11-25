import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { getFeed } from "@/lib/feed";
import { fetchArticle } from "@/lib/fetchArticle";
import { generateCard } from "@/lib/card";
import { getCachedCard, saveCard } from "@/lib/supabase";

export const maxDuration = 300;

// Pre-builds cards for the top feed stories (or given urls) so they open instantly.
export async function POST(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const n = Math.min(Number(body.count ?? 8), 12);
  const urls: string[] = Array.isArray(body.urls) && body.urls.length ? body.urls : (await getFeed()).slice(0, n).map((i) => i.url);
  const results: { url: string; status: string; verified?: string }[] = [];
  for (const url of urls) {
    try {
      if (await getCachedCard(url)) { results.push({ url, status: "already built" }); continue; }
      const card = await generateCard(await fetchArticle(url));
      await saveCard(url, card);
      results.push({ url, status: "built", verified: `${card.verification.verified}/${card.verification.total}` });
    } catch (e) {
      results.push({ url, status: "failed: " + (e instanceof Error ? e.message : "error") });
    }
  }
  return NextResponse.json({ results });
}
