import { NextResponse } from "next/server";
import { llmJson } from "@/lib/llm";

export const maxDuration = 30;
const schema = { type: "object", additionalProperties: false, required: ["line"], properties: { line: { type: "string" } } };

// Only this one line is generated per user. Everything else on the card is shared and verified.
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b?.profile || !Array.isArray(b.claims)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { role, industry, comfort } = b.profile as { role: string; industry: string; comfort: string };
  try {
    const r = await llmJson({
      system:
        "You write one short note on why a news story may matter to a specific reader. Use ONLY the verified facts given. Two sentences max, plain words. Frame it as a possibility ('If you...', 'This could...'), never as certain. Do not invent details about their employer or job. No hype, no advice to buy or invest.",
      user: `Reader: ${role}, working in ${industry}, tech comfort: ${comfort}.\nStory: ${String(b.headline ?? "").slice(0, 200)}\nVerified facts:\n${(b.claims as string[]).slice(0, 8).map((c) => "- " + String(c).slice(0, 300)).join("\n")}`,
      schemaName: "why_it_matters",
      schema,
    });
    return NextResponse.json({ line: (r.json as { line: string }).line });
  } catch (e) {
    console.error("personalize failed:", e);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
