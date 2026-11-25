import { NextResponse } from "next/server";
import { llmJson } from "@/lib/llm";

export const maxDuration = 30;
const schema = { type: "object", additionalProperties: false, required: ["explanation"], properties: { explanation: { type: "string" } } };

// "Still confusing?": re-explain ONE piece more simply, using only the quote from the article.
export async function POST(req: Request) {
  const { subject, text, quote } = await req.json().catch(() => ({}));
  if (!text || !quote) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  try {
    const r = await llmJson({
      system: "Explain things to someone with no tech background. Use ONLY what the quote says. Two short sentences max, everyday words, no jargon, one simple comparison if it helps. Never add facts that are not in the quote.",
      user: `Part to explain: ${subject || "this claim"}\nCurrent explanation: ${String(text).slice(0, 600)}\nSupporting quote from the article: ${String(quote).slice(0, 600)}`,
      schemaName: "simpler",
      schema,
    });
    return NextResponse.json({ explanation: (r.json as { explanation: string }).explanation });
  } catch (e) {
    console.error("simplify failed:", e);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
