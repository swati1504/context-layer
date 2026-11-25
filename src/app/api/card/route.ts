import { NextResponse } from "next/server";
import { fetchArticle, articleFromText, FetchError } from "@/lib/fetchArticle";
import { generateCard } from "@/lib/card";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { url, text } = await req.json().catch(() => ({}));
  try {
    const article = text ? articleFromText(String(text)) : await fetchArticle(String(url ?? ""));
    const card = await generateCard(article);
    return NextResponse.json({ card });
  } catch (e) {
    if (e instanceof FetchError) return NextResponse.json({ error: e.code, message: e.message }, { status: 422 });
    return NextResponse.json({ error: "server", message: "Could not build the card" }, { status: 500 });
  }
}
