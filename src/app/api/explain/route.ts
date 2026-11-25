import { NextResponse } from "next/server";
import { llmJson } from "@/lib/llm";

export const maxDuration = 30;
const schema = { type: "object", additionalProperties: false, required: ["covered", "explanation"], properties: { covered: { type: "boolean" }, explanation: { type: "string" } } };

// Highlight-to-explain: explain the selected words using only what the card's verified quotes say.
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const selection = String(b?.selection ?? "").trim().slice(0, 400);
  if (!selection || !Array.isArray(b?.facts)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  try {
    const r = await llmJson({
      system:
        "A reader with no tech background highlighted part of a news explainer and wants to understand it. Explain the highlighted part in at most two short sentences of everyday words. Prefer what the SOURCE PASSAGES say (covered=true). If the passages do not cover it, give a brief, careful general definition and set covered=false. Never invent news facts, numbers, dates or quotes.",
      user: `Story: ${String(b.headline ?? "").slice(0, 200)}\nHighlighted: "${selection}"\nSOURCE PASSAGES:\n${(b.facts as string[]).slice(0, 14).map((f) => "- " + String(f).slice(0, 350)).join("\n")}`,
      schemaName: "explain",
      schema,
    });
    return NextResponse.json(r.json);
  } catch (e) {
    console.error("explain failed:", e);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
